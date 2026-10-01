/**
 * Natural-language quick-create: one line of text in, a sparse event draft
 * out. Used by the create-event popover (Enter in the title field) via
 * POST /api/agent/parse-event — a single generateObject call, NOT the chat
 * agent's multi-step tool loop.
 *
 * SCHEMA POSTURE — same as tools.ts: Groq's gateway 400s the whole request
 * on any schema violation, so every property is optional, there are no
 * enums or bounds, and looseObject tolerates hallucinated extra fields.
 * The guards live in {@link sanitizeParsedEvent}, which implements
 * FIELD-LEVEL DEGRADATION: an invalid field is dropped (the popover keeps
 * whatever the user had for it) instead of failing the whole parse. A
 * parse that only salvages title and start is still a win for the user.
 */
import { z } from 'zod'
import type { AgentCategory } from './types'
import {
  COLOR_DESCRIPTION,
  colorNameToHex,
  parseIsoInstant,
  validateRrule,
} from './validation'

const isoHint = 'ISO 8601 date-time with offset, e.g. 2026-09-05T14:00:00+08:00'

export const parseEventSchema = z.looseObject({
  title: z
    .string()
    .optional()
    .describe(
      "Event title with date/time/location phrasing removed, in the user's language. Always provide it; echo the input if nothing can be extracted.",
    ),
  start: z
    .string()
    .optional()
    .describe(
      `Event start. ${isoHint}. Omit if the text states no date or time.`,
    ),
  end: z
    .string()
    .optional()
    .describe(
      `Event end, after start. ${isoHint}. Omit when the text states no end or duration — the app applies its default duration.`,
    ),
  isAllDay: z
    .boolean()
    .optional()
    .describe('True only when the text implies a whole-day event.'),
  location: z
    .string()
    .optional()
    .describe('Location stated in the text. Max 500 chars. Omit if none.'),
  description: z
    .string()
    .optional()
    .describe(
      'Extra detail from the text worth keeping as the event description. Max 2000 chars. Omit if none.',
    ),
  categoryId: z
    .string()
    .optional()
    .describe(
      "Id from the user's category list in the instructions. Omit unless one clearly fits.",
    ),
  color: z
    .string()
    .optional()
    .describe(`${COLOR_DESCRIPTION} Set only when the text mentions a color.`),
  rrule: z
    .string()
    .optional()
    .describe(
      'RFC 5545 recurrence rule with FREQ=, e.g. FREQ=WEEKLY;BYDAY=MO,WE. Only when the text describes repetition; anchor BYDAY/BYMONTHDAY to the resolved start date.',
    ),
})

export type RawParsedEvent = z.infer<typeof parseEventSchema>

/**
 * The sanitized draft returned to the popover. Every field except title is
 * optional; ABSENT means "the text said nothing — keep the user's value",
 * never "clear this field".
 */
export interface ParsedEventDraft {
  title?: string
  /** UTC ISO instant. */
  start?: string
  /** UTC ISO instant. */
  end?: string
  isAllDay?: boolean
  location?: string
  description?: string
  categoryId?: string
  /** Palette accent hex, e.g. #3B82F6. */
  color?: string
  rrule?: string
}

const MAX_LENGTHS = {
  title: 200,
  location: 500,
  description: 2000,
  rrule: 500,
} as const

function cleanString(
  value: string | undefined,
  max: number,
): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > max) return undefined
  return trimmed
}

/**
 * Drops fields the model got wrong instead of failing the parse:
 * unparseable instants, an end before the start, hallucinated category
 * ids, invented colors and prose rrules all silently vanish — the popover
 * simply keeps the user's existing value for those fields.
 */
export function sanitizeParsedEvent(
  raw: RawParsedEvent,
  context: { categories: AgentCategory[] },
): ParsedEventDraft {
  const draft: ParsedEventDraft = {}

  const title = cleanString(raw.title, MAX_LENGTHS.title)
  if (title) draft.title = title

  let startIso: string | undefined
  let startMs: number | undefined
  if (typeof raw.start === 'string') {
    const parsed = parseIsoInstant(raw.start, 'start')
    if (!('error' in parsed)) {
      startIso = parsed.iso
      startMs = parsed.date.getTime()
    }
  }
  let endIso: string | undefined
  let endMs: number | undefined
  if (typeof raw.end === 'string') {
    const parsed = parseIsoInstant(raw.end, 'end')
    if (!('error' in parsed)) {
      endIso = parsed.iso
      endMs = parsed.date.getTime()
    }
  }
  // An end that is not after the start is dropped, not repaired — the
  // popover's default-duration logic produces a saner end than guessing.
  if (startMs !== undefined && endMs !== undefined && endMs <= startMs) {
    endIso = undefined
  }
  if (startIso) draft.start = startIso
  if (endIso) draft.end = endIso

  if (typeof raw.isAllDay === 'boolean') draft.isAllDay = raw.isAllDay

  const location = cleanString(raw.location, MAX_LENGTHS.location)
  if (location) draft.location = location
  const description = cleanString(raw.description, MAX_LENGTHS.description)
  if (description) draft.description = description

  if (
    typeof raw.categoryId === 'string' &&
    context.categories.some((c) => c.id === raw.categoryId)
  ) {
    draft.categoryId = raw.categoryId
  }

  if (typeof raw.color === 'string') {
    const hex = colorNameToHex(raw.color)
    if (hex) draft.color = hex
  }

  const rrule = cleanString(raw.rrule, MAX_LENGTHS.rrule)
  if (rrule && validateRrule(rrule) === null) {
    draft.rrule = rrule.replace(/^RRULE:/i, '')
  }

  return draft
}

export function buildParseInstructions(context: {
  timezone: string
  nowIso: string
  categories: AgentCategory[]
}): string {
  const categoryList =
    context.categories.length > 0
      ? context.categories.map((c) => `${c.id} — ${c.name}`).join('; ')
      : '(the user has no categories — never return categoryId)'

  return `You extract calendar event fields from ONE line of natural language and return them as structured data. The user is typing into the title field of an event-creation form; your output pre-fills the other fields for them to review.

Current date/time: ${context.nowIso}
User timezone: ${context.timezone}

Rules:
- Resolve relative dates and times ("明天下午六点", "next Friday noon", "in two hours") against the current date/time and timezone above. Never guess a year.
- start/end must be ISO 8601 with timezone offset, e.g. 2026-09-05T18:00:00+08:00.
- title: the event's title with date, time and location phrasing removed, in the user's own language. Always provide it — if nothing can be extracted, echo the input unchanged.
- Only return fields the text states or strongly implies. Omit everything else: omitted fields keep the values the user already set in the form.
- If no end time or duration is stated, omit end.
- Set isAllDay only when the text implies a whole-day event.
- categoryId: choose only from this list (id — name): ${categoryList}. Omit when none fits.
- color: only when the text mentions a color, and only a palette name from the schema description.
- rrule: RFC 5545 with FREQ=, e.g. FREQ=WEEKLY;BYDAY=MO,WE — only when the text describes repetition ("every Monday", "每周一三五"). Anchor BYDAY/BYMONTHDAY choices to the resolved start date.
- Never invent attendees, emails, meeting links or reminders.`
}
