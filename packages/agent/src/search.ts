/**
 * The palette's semantic search: one line of half-remembered prose in, a
 * structured QUERY out. The app then runs that query itself (MCP list_events)
 * and renders the rows it gets.
 *
 * The model never answers. That is the whole point of this module existing
 * instead of a second chat mode: a search whose output is a transcript makes
 * the user read the model thinking out loud to learn which event it found, and
 * a model that "answers" from memory answers with whatever it invented. Here
 * the model can only say "last year, with Alex, about finance" and the rows
 * are whatever the database actually holds.
 *
 * SCHEMA POSTURE — the same as parse.ts, and the same reason. This schema is
 * sent as `response_format: json_schema` (OpenAI strict mode), which Groq
 * rejects unless every object is closed (`z.object`) and every key is in
 * `required` — zod emits that for `.nullable()`, not `.optional()`. So: closed
 * objects, `.nullable()` fields, `null` meaning "the user did not say". Still
 * no enums and no bounds; those live in the descriptions and in
 * {@link sanitizeSearchQuery}, which drops one bad field instead of failing the
 * search. `tests/agent/search.test.ts` pins the strict contract.
 */
import { z } from 'zod'
import type { AgentCategory } from './types'
import { parseIsoInstant } from './validation'
import { PRESET_NAMES, normalizePreset } from './presets'

const isoHint = 'ISO 8601 date-time with offset, e.g. 2026-09-05T14:00:00+08:00'

export const searchQuerySchema = z.object({
  preset: z
    .string()
    .nullable()
    .describe(
      `One of: ${PRESET_NAMES.join(', ')}. Use this whenever the user describes a span by name ("last year", "recently", "next week"). Mutually exclusive with start/end; when in doubt pick the preset over a hand-built range. Null if the user stated no time span at all.`,
    ),
  start: z
    .string()
    .nullable()
    .describe(
      `Range start, only for an exact span the user named. ${isoHint}. Null unless the user named a precise date or an open range ("since March").`,
    ),
  end: z
    .string()
    .nullable()
    .describe(
      `Range end, only for an exact span the user named. ${isoHint}. Null when there is no end.`,
    ),
  query: z
    .string()
    .nullable()
    .describe(
      'The subject words the user used, with the time and people phrasing removed: the meeting "where we discussed the budget" becomes "budget". Matched against title, description and location. Max 200 chars. Null when the search is only about time or people.',
    ),
  names: z
    .array(z.string())
    .nullable()
    .describe(
      'Participant names exactly as the user said them, e.g. ["Alex"]. Matched loosely against stored names. Null when the user mentioned no people. Never put email addresses here.',
    ),
  categories: z
    .array(z.string())
    .nullable()
    .describe(
      'Category NAMES from the list in the instructions, e.g. ["财务"]. Only when the user named a category or a topic that clearly is one. Null otherwise.',
    ),
})

export type RawSearchQuery = z.infer<typeof searchQuerySchema>

/**
 * A query the app can execute, or `{}` for "no constraint the model could
 * justify" — which the route turns into a plain recent-events listing rather
 * than an error, because "search my calendar" IS a legitimate question.
 */
export interface SearchQuery {
  /** Canonical preset name; the route resolves it to instants. */
  preset?: string
  /** UTC ISO instant. */
  start?: string
  /** UTC ISO instant. */
  end?: string
  query?: string
  names?: string[]
  categoryIds?: string[]
}

const MAX_QUERY_LENGTH = 200
const MAX_NAMES = 5
const MAX_NAME_LENGTH = 60
const MAX_CATEGORIES = 10

/**
 * Field-level degradation, same posture as sanitizeParsedEvent: a bad instant,
 * an unknown preset, an invented category name or a name the user did not
 * type all cost that one filter, never the whole search.
 *
 * The one thing it will not repair is an inverted range. start > end returns
 * nothing, and "nothing" here is indistinguishable from "you have no such
 * meeting" — so both ends are dropped and the search degrades to unfiltered
 * rather than to a lie.
 */
export function sanitizeSearchQuery(
  raw: RawSearchQuery,
  context: { categories: AgentCategory[] },
): SearchQuery {
  const query: SearchQuery = {}

  const preset = typeof raw.preset === 'string' ? raw.preset.trim() : undefined
  if (preset) {
    // normalizePreset owns the vocabulary and the aliases; an unknown word is
    // dropped here rather than 400ing at the model boundary.
    const normalized = normalizePreset(preset)
    if (normalized) query.preset = normalized
  }

  let startMs: number | undefined
  let endMs: number | undefined
  if (typeof raw.start === 'string') {
    const parsed = parseIsoInstant(raw.start, 'start')
    if (!('error' in parsed)) {
      query.start = parsed.iso
      startMs = parsed.date.getTime()
    }
  }
  if (typeof raw.end === 'string') {
    const parsed = parseIsoInstant(raw.end, 'end')
    if (!('error' in parsed)) {
      query.end = parsed.iso
      endMs = parsed.date.getTime()
    }
  }
  if (startMs !== undefined && endMs !== undefined && endMs <= startMs) {
    delete query.start
    delete query.end
  }
  // A preset already IS the range. Keeping both would make the app resolve one
  // and silently ignore the other; tools.ts resolves the same way.
  if (query.preset) {
    delete query.start
    delete query.end
  }

  const needle = cleanNeedle(raw.query)
  if (needle) query.query = needle

  const names = cleanList(raw.names, MAX_NAMES, MAX_NAME_LENGTH)
  if (names.length > 0) query.names = names

  const categoryIds = resolveCategoryIds(raw.categories, context.categories)
  if (categoryIds.length > 0) query.categoryIds = categoryIds

  return query
}

/**
 * The subject words, cleaned for a substring match.
 *
 * Quoting is the model's habit — "budget", 「财务」, “trip” — and the stored
 * field never has those characters in it, so a needle that keeps them can never
 * match anything. Collapsing whitespace matters for the same reason: the
 * database compares the needle as ONE substring, so "trip  to  Paris" is a
 * needle that exists in no event at all.
 *
 * Deliberately NOT split into words and OR-ed together. That would make the
 * search match any single common word, and "找个会议" would come back with every
 * event that has a 2-character overlap with it — the same noise as no filter at
 * all, but harder to see. One short distinctive span or nothing.
 */
function cleanNeedle(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const cleaned = value
    // Quote and list punctuation the model adds around the user's words.
    .replace(/["'“”‘’「」『』《》【()（）[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return undefined
  // An over-long needle is a sentence, and no field holds a sentence-length
  // substring: a half-sentence matches nothing either, and keeping it would
  // hide the date and participant filters behind a query that cannot match.
  // Dropping it leaves those filters working — and the plan can drop the range
  // later if the user really did mean everything in that window.
  return cleaned.length <= MAX_QUERY_LENGTH ? cleaned : undefined
}

function cleanList(
  value: string[] | null | undefined,
  maxItems: number,
  maxLength: number,
): string[] {
  if (!Array.isArray(value)) return []
  const cleaned: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string') continue
    const trimmed = entry.trim()
    if (!trimmed || trimmed.length > maxLength) continue
    if (cleaned.some((c) => c.toLowerCase() === trimmed.toLowerCase())) continue
    cleaned.push(trimmed)
    if (cleaned.length === maxItems) break
  }
  return cleaned
}

/**
 * Categories by NAME, resolved here rather than by asking the model for ids.
 * The alternative was a second model call to list the user's categories before
 * it could search them, which is a round trip and a chance to hallucinate an
 * id; a name the model invented simply does not match anything here and is
 * dropped.
 */
function resolveCategoryIds(
  value: string[] | null | undefined,
  categories: AgentCategory[],
): string[] {
  const wanted = cleanList(value, MAX_CATEGORIES, 60)
  if (wanted.length === 0 || categories.length === 0) return []
  const ids: string[] = []
  for (const name of wanted) {
    const hit =
      categories.find((c) => c.name.toLowerCase() === name.toLowerCase()) ??
      categories.find((c) => c.name.toLowerCase().includes(name.toLowerCase()))
    if (hit && !ids.includes(hit.id)) ids.push(hit.id)
  }
  return ids
}

/** True when the model constrained the search in at least one way. */
export function hasAnyFilter(query: SearchQuery): boolean {
  return Boolean(
    query.preset ||
    query.start ||
    query.end ||
    query.query ||
    query.names?.length ||
    query.categoryIds?.length,
  )
}

/** A filter the widening plan can drop, in the order it gives them up. */
export type Relaxation = 'names' | 'categories' | 'range' | 'keyword'

export interface SearchAttempt {
  query: SearchQuery
  /** What this attempt gives up relative to the resolved query; null for the first. */
  relaxed: Relaxation | null
}

/**
 * How wide the keyword-less attempt is allowed to be. Past a season, "show me
 * everything in this range" is the noise the search exists to avoid, so past
 * this width the plan stops instead of dropping the keyword.
 */
const MAX_KEYWORD_DROPPED_RANGE_MS = 93 * 86_400_000

/**
 * The search, then the same search with one filter given up at a time.
 *
 * The model translates prose into filters, and a filter it got wrong does not
 * return "nothing" — it returns nothing, which the user reads as "you never had
 * that meeting". Since a mistranslation is far more likely than an absent
 * event, an empty result page is treated as evidence against the filters and
 * the search is re-run wider. Every attempt is a plain database read; the model
 * is not asked twice.
 *
 * The order is the judgement, and it is deliberate:
 *  - names first: a name is the easiest thing to invent, and "和 Alex" is common
 *    while a stored participant for that meeting may simply not exist.
 *  - categories next: resolvable from the user's own list, but the user may name
 *    a topic ("财务") that maps to a real category the events do not use.
 *  - the range before the keyword: dropping the range is SAFE while a keyword
 *    still has to match ("旅游" anywhere in history is a search), whereas
 *    dropping the keyword is only safe inside a narrow window.
 *  - the keyword last, and only inside a window of at most 93 days.
 *
 * A query with nothing to drop yields a single attempt, so this can never
 * widen into an unbounded listing.
 */
export function buildSearchPlan(
  query: SearchQuery,
  range: { start?: string; end?: string } = {},
): SearchAttempt[] {
  const attempts: SearchAttempt[] = [{ query, relaxed: null }]
  const hasRange = Boolean(
    query.preset || query.start || query.end || range.start || range.end,
  )
  const hasScope = Boolean(query.query || query.names?.length)

  if (query.names?.length) {
    const { names, ...rest } = query
    void names
    attempts.push({ query: rest, relaxed: 'names' })
  }
  if (query.categoryIds?.length) {
    const { categoryIds, ...rest } = query
    void categoryIds
    attempts.push({ query: rest, relaxed: 'categories' })
  }
  if (hasRange && hasScope) {
    const { preset, start, end, ...rest } = query
    void preset
    void start
    void end
    attempts.push({ query: rest, relaxed: 'range' })
  }
  if (query.query && rangeIsNarrow(range)) {
    const { query: needle, ...rest } = query
    void needle
    attempts.push({ query: rest, relaxed: 'keyword' })
  }
  return attempts
}

/** Both ends inside one bounded window, or one end inside it. */
function rangeIsNarrow(range: { start?: string; end?: string }): boolean {
  const start = range.start ? Date.parse(range.start) : Number.NaN
  const end = range.end ? Date.parse(range.end) : Number.NaN
  if (Number.isNaN(start) && Number.isNaN(end)) return false
  if (!Number.isNaN(start) && !Number.isNaN(end)) {
    return end - start <= MAX_KEYWORD_DROPPED_RANGE_MS
  }
  // One open end: bounded only if the other end is close enough to "now" that
  // the window cannot be a decade of history.
  const openStart = Number.isNaN(start)
  const known = openStart ? end : start
  const now = Date.now()
  return (openStart ? now - known : known - now) <= MAX_KEYWORD_DROPPED_RANGE_MS
}

export function buildSearchInstructions(context: {
  timezone: string
  nowIso: string
  categories: AgentCategory[]
  /** The previous query, so a follow-up can be answered as a whole. */
  previousQuery?: SearchQuery
  /** The user's follow-up text; only read when previousQuery is present. */
  lastUserText?: string
}): string {
  const categoryList =
    context.categories.length > 0
      ? context.categories.map((c) => c.name).join('; ')
      : '(the user has no categories)'

  const previous =
    context.previousQuery && Object.keys(context.previousQuery).length > 0
      ? `
This is a FOLLOW-UP search. The previous query was:
${JSON.stringify(context.previousQuery)}
The user's follow-up is: "${context.lastUserText ?? ''}"
Return a COMPLETE query for the follow-up, not a patch: keep every field above that the user did not change, and change only what they did. For "and this year too", keep query and names and replace the range.`
      : ''

  return `You translate a half-remembered description into a search over the user's calendar. You do NOT answer the question and you do NOT write any prose: the app runs your query and shows the user the real events.

Current date/time: ${context.nowIso}
User timezone: ${context.timezone}

Rules:
- Put the SUBJECT in query, with the time and people phrasing removed. "去年和 Alex 讨论项目的会议" → query "项目", names ["Alex"], preset "last_year". "上个月所有关于财务的安排" → query "财务", preset "last_month". "去旅游的那次" → query "旅游", preset "last_year", names null.
- query must be ONE short distinctive span, the words that would appear in the event itself: never a whole sentence, never "去年去旅游的会议" (nothing in the database holds that as a substring, so the search comes back empty and the user is told they never had that trip). Drop every word you have already turned into preset, names or categories.
- query is matched as a substring against title, description and location. Use the words the user actually used, not your own paraphrase of them.
- preset when the user describes a span by name. Use: ${PRESET_NAMES.join(', ')}. "last year" is the last calendar year, not the last 365 days; "recently" is last_30_days. Resolve against the current date above and never guess a year.
- start/end only for an exact span ("from March 3 to March 20"), never alongside preset.
- names for people, exactly as the user said them. Never invent an email address, and never put an address in names.
- categories only from this list of the user's category NAMES: ${categoryList}. Null if none fits; an invented name is dropped by the app.
- If the user named a time span, ALWAYS put it in preset or start/end. "找个会议" is not an invitation to list the whole calendar: an all-null query is the one thing you must never return, because it comes back as every event the user has ever had. If they truly said nothing searchable, return a sensible recent window (last_30_days or last_90_days) rather than nulls everywhere.
- Omit a filter the user did not state rather than guessing one. A too-narrow query returns nothing, and nothing looks like "you never had that meeting".${previous}`
}
