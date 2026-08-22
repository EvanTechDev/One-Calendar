import { z } from 'zod'
import {
  DEFAULT_COUNTDOWN_ICON,
  isCountdownIconName,
} from '@/lib/countdown-icons'

// The calendar client stores colors as Tailwind classes, not raw hex:
// events use arbitrary values ("bg-[#E6F6FD]"), categories/countdowns use the
// palette ("bg-blue-500", "bg-indigo-500", ...). Raw hex is kept for other
// consumers (imports, MCP). Union of all three, nothing else.
const hexColor = '#[0-9a-fA-F]{6}'
const paletteColor =
  'bg-(blue|green|yellow|red|purple|pink|teal|indigo|orange)-500'

export const colorRegex = new RegExp(
  `^(?:${hexColor}|${paletteColor}|bg-\\[${hexColor}\\])$`,
)

export const dateTimeString = z
  .string()
  .datetime({ offset: true })
  .or(z.string().datetime())

// Countdowns POST targetDate as "YYYY-MM-DD" (no time component).
export const dateOnlyString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

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
  events: z.array(eventSchema).max(500).optional(),
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

export type RsvpStatus = (typeof RSVP_STATUSES)[number]

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

export function firstZodMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'issues' in error) {
    const issues = (error as { issues: Array<{ message: string }> }).issues
    return issues[0]?.message ?? 'Invalid input'
  }
  return 'Invalid input'
}
