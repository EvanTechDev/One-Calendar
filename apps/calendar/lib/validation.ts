import { z } from 'zod'
import { RRule } from 'rrule'
import {
  DEFAULT_COUNTDOWN_ICON,
  isCountdownIconName,
} from '@zntr/calendar-ui/lib/countdown-icons'
import {
  CALENDAR_COLOR_OPTIONS,
  type CalendarColor,
} from '@zntr/calendar-ui/lib/calendar-colors'

// The calendar client stores colors as Tailwind classes, not raw hex:
// events use arbitrary values ("bg-[#E6F6FD]"), categories/countdowns use the
// palette ("bg-blue-500", "bg-indigo-500", ...). Raw hex is kept for other
// consumers (imports, MCP). Union of all three, nothing else.
const hexColor = '#[0-9a-fA-F]{6}'
const paletteColor =
  'bg-(blue|green|yellow|red|purple|pink|teal|indigo|orange)-500'

const colorRegex = new RegExp(
  `^(?:${hexColor}|${paletteColor}|bg-\\[${hexColor}\\])$`,
)

// Zod 4.5+ requires seconds by default; retain our minute-precision inputs.
const dateTimeString = z.union([
  z.iso.datetime({ offset: true }),
  z.iso.datetime({ offset: true, precision: -1 }),
])

// Countdowns POST targetDate as "YYYY-MM-DD" (no time component).
const dateOnlyString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/**
 * Whether `rrule` is a rule `expandSeries` can actually expand.
 *
 * `RRule.fromString` throws on anything malformed, and `expandSeries` catches
 * that into `occurrences = []` — so a stored-but-unparsable rule is a series
 * that exists in the database and renders as nothing. The write paths that
 * take a rule from a live client (POST /api/events) validate it before storing
 * for exactly this reason; import has to hold the same line.
 */
function isParsableRrule(rule: string | null | undefined): boolean {
  if (rule === null || rule === undefined) return true
  try {
    return (
      typeof RRule.fromString(rule.replace(/^RRULE:/i, '')).options.freq ===
      'number'
    )
  } catch {
    return false
  }
}

export const eventSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
  location: z.string().max(500).nullish(),
  startDate: dateTimeString,
  endDate: dateTimeString,
  isAllDay: z.boolean().optional(),
  status: z.enum(['confirmed', 'tentative', 'cancelled']).optional(),
  color: z.string().regex(colorRegex).nullish(),
  categoryId: z.string().nullish(),
  participants: z
    .array(
      z.object({
        name: z.string().max(100),
        email: z.string().email().nullish(),
        userId: z.string().nullish(),
      }),
    )
    .max(50)
    .nullish(),
  notificationMinutes: z.number().int().min(0).max(10080).nullish(),
  /** Also deliver the reminder by email. See ADR-0010. */
  emailReminder: z.boolean().optional(),
})

/**
 * Recurrence fields on an event write, validated alongside `eventSchema`.
 *
 * `nullish`, not `optional`: the client sends `rrule: null` / `exdate: null` for
 * a non-recurring event, and `JSON.stringify` preserves null while dropping
 * undefined — so `optional()` rejected every plain event save with
 * "Invalid input: expected string, received null". Null and absent both mean
 * "not recurring" here, and the route already treats them identically.
 */
export const recurringFieldsSchema = z.object({
  rrule: z.string().max(500).nullish(),
  exdate: z.array(z.string()).max(500).nullish(),
  apply_to: z.enum(['all', 'single', 'following']).nullish(),
})

/**
 * RFC 5545 stamp: local `YYYYMMDD` for an all-day occurrence, UTC
 * `YYYYMMDDTHHMMSSZ` for a timed one. Mirrors the regex on
 * `invitePatchSchema.recurrenceId`, which cannot be shared because that field is
 * a plain string constraint rather than a parse.
 */
const stampString = z
  .string()
  .regex(
    /^\d{8}(T\d{6}Z)?$/,
    'recurrenceId must be an RFC stamp (YYYYMMDD or YYYYMMDDTHHMMSSZ)',
  )

/**
 * Import variant of {@link recurringFieldsSchema}, plus the two fields that make
 * a row an Override rather than a Series master.
 *
 * Import previously used the bare {@link eventSchema}, which has no
 * `rrule`/`exdate` keys at all — zod strips unknown keys, so a backup restore
 * flattened every recurring series into one non-recurring event at the master's
 * anchor, and every single-instance edit into a detached standalone event. See
 * `lib/ics.ts` for the round-trip contract this violated.
 *
 * `rrule` is validated here rather than merely bounded, because `expandSeries`
 * swallows a parse failure into an empty occurrence list: an unvalidated rule
 * would restore as a series that exists in the database and renders empty
 * everywhere, with no error anywhere. Rejecting the file up front is the
 * recoverable failure; the phantom series is not.
 */
export const importRecurringFieldsShape = {
  rrule: z
    .string()
    .max(500)
    .nullish()
    .refine(isParsableRrule, { message: 'Unparsable recurrence rule' }),
  exdate: z.array(stampString).max(500).nullish(),
  seriesId: z.string().min(1).max(100).nullish(),
  recurrenceId: stampString.nullish(),
}

/**
 * The settings blob.
 *
 * This is the one place settings are described, and `SettingsData` is inferred
 * from it rather than written beside it. Those two were separate before: the
 * route merged whatever the request body contained into a JSON column, and the
 * TypeScript interface only ever described what readers happened to assume.
 * Any key could be stored — `app/api/account/onboarding-complete` stores one
 * that is not on the interface at all — and a reader that trusted the type was
 * trusting a claim nobody checked.
 *
 * Unknown keys are dropped rather than rejected. A newer client may know a
 * setting this build does not, and answering 400 would make that a broken
 * app; storing it is what the column was for.
 */
export const settingsSchema = z.object({
  language: z.string().max(35).optional(),
  // The onboarding dialog holds its answers in a `Record<string, string>`, so
  // this arrives as '1' there and as 1 from the settings dialog. Both are
  // accepted. The route used to call `Number()` on it unconditionally, which
  // turned 'abc' into NaN and stored that as null.
  firstDayOfWeek: z
    .union([z.number(), z.string().regex(/^\d{1,2}$/)])
    .transform(Number)
    .pipe(z.number().int().min(0).max(6))
    .optional(),
  timezone: z.string().max(100).optional(),
  defaultView: z.enum(['day', 'week', 'month', 'year', 'four-day']).optional(),
  timeFormat: z.enum(['24h', '12h']).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  calendarColor: z
    .enum(
      CALENDAR_COLOR_OPTIONS.map((o) => o.value) as [
        CalendarColor,
        ...CalendarColor[],
      ],
    )
    .optional(),
  enableShortcuts: z.boolean().optional(),
  skipLanding: z.boolean().optional(),
  // Not user-settable; set by POST /api/account/onboarding-complete and read
  // by app/page.tsx to decide whether to show onboarding.
  onboardingCompleted: z.boolean().optional(),
})

/**
 * Settings as they arrive from a client, where the whole body may be anything.
 * Parsed before it is merged over the stored blob.
 */
export const settingsPatchSchema = z
  .record(z.string(), z.unknown())
  .pipe(settingsSchema)

export type SettingsData = z.infer<typeof settingsSchema>

export const categorySchema = z.object({
  id: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(50),
  color: z.string().regex(colorRegex),
  sortOrder: z.number().int().min(0).max(10000).optional(),
})

export const countdownSchema = z.object({
  id: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(100),
  targetDate: dateTimeString.or(dateOnlyString),
  repeat: z.string().max(20).optional(),
  description: z.string().max(1000).nullish(),
  color: z.string().regex(colorRegex).nullish(),
  // Restricted to the shared catalogue: an unknown name is silently rendered
  // as the fallback Clock, so accepting it here just stores a value the UI can
  // never show. Kept nullish because the icon is optional.
  icon: z
    .string()
    .max(50)
    .refine(isCountdownIconName, {
      message: 'Unknown countdown icon',
    })
    .nullish(),
})

/**
 * Import variant of {@link countdownSchema}.
 *
 * A backup can predate the icon catalogue or come from another install, and
 * rejecting the whole file over one unrecognised icon would be hostile. Unknown
 * icons are coerced to the default instead — the countdown still restores, and
 * the UI would have rendered that fallback anyway.
 */
const importCountdownSchema = countdownSchema.extend({
  icon: z
    .string()
    .max(50)
    .nullish()
    .transform((value) =>
      value && isCountdownIconName(value) ? value : DEFAULT_COUNTDOWN_ICON,
    ),
})

export const importSchema = z.object({
  // `eventSchema.extend`, not `and(...)`: the import payload carries an
  // occurrence's series identity alongside the series' own rule, and an
  // intersection type would make every consumer re-narrow the merged shape.
  events: z
    .array(eventSchema.extend(importRecurringFieldsShape))
    .max(500)
    .optional(),
  categories: z.array(categorySchema).max(200).optional(),
  countdowns: z.array(importCountdownSchema).max(200).optional(),
  bookmarks: z
    .array(z.object({ eventId: z.string() }))
    .max(500)
    .optional(),
  settings: z
    .record(z.string(), z.unknown())
    .refine((value) => Object.keys(value).length <= 256, {
      message: 'Too many settings keys',
    })
    .optional(),
})

export const bookmarkSchema = z.object({
  id: z.string().uuid().optional(),
  eventId: z.string(),
})

export const RSVP_STATUSES = [
  'pending',
  'accepted',
  'maybe',
  'declined',
] as const

/**
 * Body of `PATCH /api/invite/[token]`. Both fields are optional — the client
 * sends `status` to RSVP and `categoryId` to file the event into a calendar —
 * but at least one must be present, so an empty body is a 400 rather than a
 * silent success.
 */
export const invitePatchSchema = z
  .object({
    status: z.enum(RSVP_STATUSES).optional(),
    categoryId: z.string().min(1).max(100).optional(),
    /**
     * RFC stamp of the occurrence being answered. Required to RSVP to a
     * recurring event, because each occurrence carries its own answer — see
     * ADR-0005 (participant visibility is a baseline range plus per-stamp exceptions).
     */
    recurrenceId: z
      .string()
      .regex(
        /^\d{8}(T\d{6}Z)?$/,
        'recurrenceId must be an RFC stamp (YYYYMMDD or YYYYMMDDTHHMMSSZ)',
      )
      .optional(),
  })
  .refine(
    (value) => value.status !== undefined || value.categoryId !== undefined,
    { message: 'Provide status or categoryId' },
  )

/**
 * Body of `PATCH /api/invites/self`. The same writes as the token endpoint,
 * but the caller is identified by session and names the invite by token in the
 * body — the token here is an identifier, not a credential, so link expiry
 * does not apply (ADR-0013: the invite link expires; the grant does not).
 */
export const inviteSelfPatchSchema = z
  .object({
    inviteToken: z.string().min(1).max(100),
    status: z.enum(RSVP_STATUSES).optional(),
    categoryId: z.string().min(1).max(100).optional(),
    recurrenceId: z
      .string()
      .regex(
        /^\d{8}(T\d{6}Z)?$/,
        'recurrenceId must be an RFC stamp (YYYYMMDD or YYYYMMDDTHHMMSSZ)',
      )
      .optional(),
  })
  .refine(
    (value) => value.status !== undefined || value.categoryId !== undefined,
    { message: 'Provide status or categoryId' },
  )

export function firstZodMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'issues' in error) {
    const issues = (error as { issues: Array<{ message: string }> }).issues
    return issues[0]?.message ?? 'Invalid input'
  }
  return 'Invalid input'
}
