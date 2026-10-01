/**
 * Natural-language quick-create: one line of text in, a sparse event draft
 * out. Used by the create-event popover (Enter in the title field) via
 * POST /api/agent/parse-event — a single generateObject call, NOT the chat
 * agent's multi-step tool loop.
 *
 * SCHEMA POSTURE — the OPPOSITE of tools.ts, and the difference is not
 * cosmetic. This schema is sent as `response_format: json_schema`, i.e.
 * OpenAI strict mode, and Groq rejects the request outright otherwise:
 *
 *   invalid JSON schema for response_format: 'response':
 *   `additionalProperties:false` must be set on every object
 *
 * So every object here must be CLOSED (`z.object` emits
 * `additionalProperties: false`; `z.looseObject` emits `{}` and 400s) and
 * every key must appear in `required`. Zod gets both by making each field
 * `.nullable()` rather than `.optional()` — `required: [all keys]` with
 * `anyOf: [type, null]`, which is the canonical strict-mode encoding.
 *
 * `null` is also exactly the sparse contract we want: it means "the text
 * did not state this", so the popover keeps the user's own value. There
 * are still no enums and no bounds — those live in the descriptions and in
 * {@link sanitizeParsedEvent}, which implements FIELD-LEVEL DEGRADATION: an
 * invalid field is dropped instead of failing the whole parse, so a parse
 * that only salvages title and start is still a win for the user.
 *
 * Do not "align" this with tools.ts. The tool-calling channel wants a
 * loose schema (the gateway validates tool args itself and one
 * hallucinated extra key killed whole conversations); strict mode forbids
 * extras by construction. `tests/agent/parse.test.ts` asserts both halves
 * of the strict contract so the two postures cannot be confused again.
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

export const parseEventSchema = z.object({
  title: z
    .string()
    .nullable()
    .describe(
      "Event title with date/time/location phrasing removed, in the user's language. Always provide it; echo the input if nothing can be extracted.",
    ),
  start: z
    .string()
    .nullable()
    .describe(
      `Event start. ${isoHint}. Null if the text states no date or time.`,
    ),
  end: z
    .string()
    .nullable()
    .describe(
      `Event end, after start. ${isoHint}. Null when the text states no end or duration — the app applies its default duration.`,
    ),
  isAllDay: z
    .boolean()
    .nullable()
    .describe('True only when the text implies a whole-day event.'),
  location: z
    .string()
    .nullable()
    .describe('Location stated in the text. Max 500 chars. Null if none.'),
  description: z
    .string()
    .nullable()
    .describe(
      'Extra detail from the text worth keeping as the event description. Max 2000 chars. Null if none.',
    ),
  categoryId: z
    .string()
    .nullable()
    .describe(
      "Id from the user's category list in the instructions. Null unless one clearly fits.",
    ),
  color: z
    .string()
    .nullable()
    .describe(`${COLOR_DESCRIPTION} Null unless the text mentions a color.`),
  rrule: z
    .string()
    .nullable()
    .describe(
      'RFC 5545 recurrence rule with FREQ=, e.g. FREQ=WEEKLY;BYDAY=MO,WE. Null unless the text describes repetition; anchor BYDAY/BYMONTHDAY to the resolved start date.',
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

/**
 * Null is the wire format for "not stated" (strict mode requires every key,
 * see the schema posture note) and undefined covers hand-built callers, so
 * both land on the same branch: the field is simply absent.
 */
function cleanString(
  value: string | null | undefined,
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
