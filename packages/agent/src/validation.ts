/**
 * Argument validation for the agent's tools, mirroring the MCP server's
 * posture (apps/calendar/lib/mcp/server.ts): every enum-like argument is a
 * closed vocabulary in the JSON schema itself, so the model sees the legal
 * values up front instead of inventing them; everything the schema cannot
 * express (real ISO instants, ordering, existing category ids) is checked
 * in execute and returned as a correctable error result.
 *
 * The palette is a MIRROR of apps/calendar/lib/mcp/colors.ts COLOR_OPTIONS.
 * It is duplicated because this package must not import the app (the port
 * boundary); if the app palette changes, update this list in lockstep —
 * tests in tests/agent/ pin the values.
 */
export const EVENT_COLOR_OPTIONS = [
  { name: 'blue', hex: '#3B82F6' },
  { name: 'green', hex: '#10B981' },
  { name: 'amber', hex: '#F59E0B' },
  { name: 'red', hex: '#EF4444' },
  { name: 'purple', hex: '#8B5CF6' },
  { name: 'pink', hex: '#EC4899' },
  { name: 'teal', hex: '#14B8A6' },
] as const

export const EVENT_COLOR_NAMES = EVENT_COLOR_OPTIONS.map((c) => c.name)

const HEX_BY_NAME = new Map<string, string>(
  EVENT_COLOR_OPTIONS.map((c) => [c.name, c.hex]),
)
const NAME_SET = new Set<string>(EVENT_COLOR_NAMES)
const HEX_SET = new Set<string>(EVENT_COLOR_OPTIONS.map((c) => c.hex))

export const COLOR_DESCRIPTION = `Color name, one of: ${EVENT_COLOR_NAMES.join(', ')}. No other value is accepted.`

/** Name → stored hex. Accepts a known hex as passthrough for robustness. */
export function colorNameToHex(value: string): string | null {
  const trimmed = value.trim()
  const byName = HEX_BY_NAME.get(trimmed.toLowerCase())
  if (byName) return byName
  const upper = trimmed.toUpperCase()
  if (HEX_SET.has(upper)) return upper
  return null
}

export function isKnownColor(value: string): boolean {
  return (
    NAME_SET.has(value.trim().toLowerCase()) ||
    HEX_SET.has(value.trim().toUpperCase())
  )
}

/**
 * Strict ISO 8601 date-time: date, time, and an explicit offset or Z.
 * `new Date()` alone accepts far too much ("tomorrow 5pm" → Invalid Date
 * is fine, but "2026-9-5" silently parses in some engines).
 */
const ISO_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/

export interface ParsedInstant {
  iso: string
  date: Date
}

export function parseIsoInstant(
  value: string,
  label: string,
): ParsedInstant | { error: string } {
  const trimmed = value.trim()
  if (!ISO_DATETIME_RE.test(trimmed)) {
    return {
      error: `${label} must be an ISO 8601 date-time with timezone offset, e.g. 2026-09-05T14:00:00+08:00 (got "${value}")`,
    }
  }
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) {
    return { error: `${label} is not a valid date-time: "${value}"` }
  }
  return { iso: date.toISOString(), date }
}

/** Parse a start/end pair and require start < end. */
export function parseInstantRange(
  start: string,
  end: string,
): { start: ParsedInstant; end: ParsedInstant } | { error: string } {
  const parsedStart = parseIsoInstant(start, 'start')
  if ('error' in parsedStart) return parsedStart
  const parsedEnd = parseIsoInstant(end, 'end')
  if ('error' in parsedEnd) return parsedEnd
  if (parsedEnd.date.getTime() <= parsedStart.date.getTime()) {
    return { error: `end (${end}) must be after start (${start})` }
  }
  return { start: parsedStart, end: parsedEnd }
}

/**
 * Minimal RRULE sanity: FREQ is mandatory and must be a real frequency.
 * Full validation happens in the app layer (rrule.js); this catches the
 * model handing over prose ("every monday") before it hits the database.
 */
const RRULE_FREQ_RE =
  /(^|;)FREQ=(SECONDLY|MINUTELY|HOURLY|DAILY|WEEKLY|MONTHLY|YEARLY)($|;)/i

export function validateRrule(value: string): string | null {
  const trimmed = value.trim().replace(/^RRULE:/i, '')
  if (!RRULE_FREQ_RE.test(trimmed)) {
    return `rrule must be an RFC 5545 rule containing FREQ=, e.g. FREQ=WEEKLY;BYDAY=MO (got "${value}")`
  }
  return null
}

/**
 * Execute-layer guards replacing what the JSON schema can no longer say.
 *
 * Groq's gateway validates tool-call arguments against the schema and a
 * violation 400s the WHOLE stream — a missing required field, an invented
 * enum value, an out-of-range number all killed conversations dead. So the
 * published schemas are deliberately permissive (everything optional, no
 * enums, no bounds; constraints live in the descriptions) and these guards
 * re-impose them as error RESULTS the model reads and corrects.
 */

/** Missing/blank required string → error naming every absent field. */
export function requireFields(
  input: Record<string, unknown>,
  fields: string[],
): { error: string } | null {
  const missing = fields.filter((f) => {
    const v = input[f]
    return v === undefined || v === null || (typeof v === 'string' && !v.trim())
  })
  if (missing.length === 0) return null
  return {
    error: `Missing required field${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Provide ${missing.length > 1 ? 'them' : 'it'} and call the tool again.`,
  }
}

export const APPLY_TO_VALUES = ['all', 'single', 'following'] as const
export type ApplyToValue = (typeof APPLY_TO_VALUES)[number]

export function validateApplyTo(
  value: string | undefined,
): { error: string } | { applyTo: ApplyToValue | undefined } {
  if (value === undefined) return { applyTo: undefined }
  const normalized = value.trim().toLowerCase()
  if ((APPLY_TO_VALUES as readonly string[]).includes(normalized)) {
    return { applyTo: normalized as ApplyToValue }
  }
  return {
    error: `Invalid applyTo "${value}". Use one of: ${APPLY_TO_VALUES.join(', ')}.`,
  }
}

export function validateColor(
  value: string | undefined,
): { error: string } | { hex: string | undefined } {
  if (value === undefined) return { hex: undefined }
  const hex = colorNameToHex(value)
  if (hex) return { hex }
  return {
    error: `Invalid color "${value}". ${COLOR_DESCRIPTION}`,
  }
}

/** Clamp a number into [min, max]; non-numbers become undefined. */
export function clampInt(
  value: unknown,
  min: number,
  max: number,
): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined
  return Math.min(Math.max(Math.round(value), min), max)
}

export function validateMaxLength(
  input: Record<string, unknown>,
  limits: Record<string, number>,
): { error: string } | null {
  for (const [field, max] of Object.entries(limits)) {
    const v = input[field]
    if (typeof v === 'string' && v.length > max) {
      return {
        error: `${field} is too long (${v.length} chars; max ${max}). Shorten it.`,
      }
    }
  }
  return null
}
