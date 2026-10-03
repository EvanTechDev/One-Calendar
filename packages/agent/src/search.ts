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

/** One thing the search gave up, in the order the plan gives them up. */
export type Relaxation = 'names' | 'categories' | 'range' | 'keyword'

export interface SearchAttempt {
  query: SearchQuery
  /** What this attempt gave up relative to the resolved query; empty for the first. */
  relaxed: Relaxation[]
}

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
 *  - the range last: dropping it is SAFE while words still have to match ("旅游"
 *    anywhere in history is a search), and it is the filter whose loss hurts
 *    most — the user named those dates.
 *  - and NEVER the words. An attempt with no words returns every event in the
 *    window, which is the noise this search exists to avoid: a plan that can
 *    delete the keyword will eventually answer "上次去东京旅游" with a hiking
 *    trip somewhere else. When the words miss, they are LOOSENED instead — see
 *    {@link needleCandidates} and {@link buildSearchAttempts}.
 *
 * A query with nothing to drop yields a single attempt, so this can never
 * widen into an unbounded listing.
 */
export function buildSearchPlan(
  query: SearchQuery,
  range: { start?: string; end?: string } = {},
): SearchAttempt[] {
  const attempts: SearchAttempt[] = [{ query, relaxed: [] }]
  const hasRange = Boolean(
    query.preset || query.start || query.end || range.start || range.end,
  )
  const hasScope = Boolean(query.query || query.names?.length)

  if (query.names?.length) {
    const { names, ...rest } = query
    void names
    attempts.push({ query: rest, relaxed: ['names'] })
  }
  if (query.categoryIds?.length) {
    const { categoryIds, ...rest } = query
    void categoryIds
    attempts.push({ query: rest, relaxed: ['categories'] })
  }
  if (hasRange && hasScope) {
    const { preset, start, end, ...rest } = query
    void preset
    void start
    void end
    attempts.push({ query: rest, relaxed: ['range'] })
  }
  return attempts
}

/**
 * How many words to try, how many of them a widened step may re-try, and how
 * many database reads the whole search may cost.
 *
 * The counts are ceilings, not targets: the search stops at the first attempt
 * that finds anything, so a question whose best word works costs exactly one
 * read. They exist because the ceiling that matters is the user's patience.
 */
const MAX_NEEDLES = 6
const NEEDLES_PER_WIDENED_STEP = 2
const MAX_ATTEMPTS = 16
const MAX_WHOLE_RUN = 8

/**
 * The words to try, most likely to match an event first.
 *
 * Two things are wrong with trusting the model's `query` alone, and one sentence
 * shows both: "上次去东京旅游的日程".
 *
 *  - The model writes the subject as it read it — "东京旅游" — and the stored
 *    event may say "东京之旅", "旅游行程" or "Trip to Tokyo". A longer needle
 *    matches fewer rows, so shorter ones have to be tried too.
 *  - The model sometimes writes a word that is not in the event at all ("trip",
 *    from the shape of the sentence rather than from the calendar) and leaves
 *    out the one that is. The user's own text is still here, and "东京" is in
 *    it.
 *
 * So the words are derived from the RAW text, deterministically, and the model's
 * read joins them as the LAST resort rather than the first: the user's own
 * words are evidence, the model's paraphrase is a guess. Within the derived
 * ones the order is discovery order — word-like pieces first, the whole run
 * last, because a five-character run is the least likely substring of any one
 * event title. The first candidate that matches wins, so the search never
 * answers from a word the user did not type.
 */
export function needleCandidates(text: string, modelNeedle?: string): string[] {
  const words: string[] = []
  const runs: string[] = []
  const seen = new Set<string>()
  const add = (bucket: string[], value: string | undefined) => {
    if (!value) return
    const trimmed = value.trim()
    if (!trimmed || trimmed.length > MAX_QUERY_LENGTH) return
    const key = trimmed.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    bucket.push(trimmed)
  }

  // The text, minus everything that is about WHEN (already a preset) or about
  // WHAT KIND OF THING (a container word, not a subject). Longest first, so a
  // compound word goes before its own parts and never leaves one behind.
  let rest = (text ?? '').toLowerCase()
  for (const word of [...TIME_WORDS, ...CONTAINER_WORDS].sort(
    (a, b) => b.length - a.length,
  )) {
    // Latin words are removed at word boundaries only. A naive split turns
    // "finance" into "f" + "ance" the moment the list holds "an", and the
    // halves are then offered as subjects of their own. Chinese has no
    // boundaries to respect, so there the split is the whole match.
    rest = /^[a-z0-9 ]+$/.test(word)
      ? rest.replace(new RegExp(`\\b${word}\\b`, 'g'), ' ')
      : rest.split(word).join(' ')
  }

  // Chinese has no spaces, so a run is offered as overlapping bigrams — "东京旅游"
  // offers 东京 and 旅游, which is what finds "东京之旅" and "旅游行程" — and then
  // whole, as the long shot. Latin is tokenised word by word, because
  // "trip to Tokyo" is two independent words and either may be the subject.
  for (const token of rest.split(/[^\p{L}\p{N}]+/u)) {
    if (!token) continue
    if (CJK.test(token)) {
      for (let i = 0; i + 2 <= token.length; i += 1) {
        const gram = token.slice(i, i + 2)
        if ([...gram].some((ch) => FUNCTION_CHARS.has(ch))) continue
        add(words, gram)
      }
      if (token.length >= 2 && token.length <= MAX_WHOLE_RUN) add(runs, token)
      continue
    }
    // One character and bare digits are not subjects: a digit in a question is
    // a date or a count, and both are resolved elsewhere.
    if (token.length < 2 || /^\d+$/.test(token)) continue
    add(words, token)
  }

  // The model's read is a paraphrase of what the user typed, so it goes last:
  // it is the fallback for when the user's own words all miss.
  add(words, modelNeedle)
  return [...words, ...runs].slice(0, MAX_NEEDLES)
}

/**
 * Every attempt the search may run: each step of the plan, once per candidate
 * word, strictest first.
 *
 * Filters on the OUTSIDE, words on the INSIDE, and that is the argument for
 * both: the dates and the people are what the user TOLD us, so a row that
 * ignores them is a worse lie than one that matched a looser word; the words are
 * what the search is FOR, so within a step they only get shorter.
 *
 * A widened step re-tries only the first couple of words. Widening is already a
 * concession, and re-reading the database once per leftover word on top of it
 * buys rows that are less likely, not more.
 *
 * `strict` runs the first combination alone, which is what paging needs: page 2
 * has to continue through the search page 1 found, not through a wider one.
 */
export function buildSearchAttempts(
  plan: SearchAttempt[],
  needles: string[],
  options: { strict?: boolean } = {},
): SearchAttempt[] {
  const steps = options.strict ? plan.slice(0, 1) : plan
  const attempts: SearchAttempt[] = []
  for (const [stepIndex, step] of steps.entries()) {
    if (needles.length === 0) {
      attempts.push(step)
      continue
    }
    const words = options.strict
      ? needles.slice(0, 1)
      : stepIndex === 0
        ? needles
        : needles.slice(0, NEEDLES_PER_WIDENED_STEP)
    words.forEach((needle, index) => {
      attempts.push({
        query: { ...step.query, query: needle },
        // Only a word the search had to fall back on counts as a relaxation:
        // the first candidate is the best one the text could give on its own.
        relaxed: index === 0 ? step.relaxed : [...step.relaxed, 'keyword'],
      })
    })
  }
  return attempts.slice(0, MAX_ATTEMPTS)
}

const CJK = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/

/**
 * Words that say WHEN. The model has already turned these into a preset or a
 * range, and no event is titled "去年" or "last week" — leaving one in the
 * words is how "去年去东京旅游" becomes a substring nothing holds.
 */
const TIME_WORDS = [
  '前天',
  '后天',
  '今天',
  '明天',
  '昨天',
  '今日',
  '明日',
  '昨日',
  '今晚',
  '昨晚',
  '今早',
  '早上',
  '中午',
  '下午',
  '晚上',
  '半夜',
  '凌晨',
  '本周',
  '这周',
  '下周',
  '上周',
  '上上周',
  '周末',
  '本周末',
  '上周末',
  '下周末',
  '本月',
  '这个月',
  '下月',
  '上月',
  '上个月',
  '上上个月',
  '月初',
  '月中',
  '月底',
  '今年',
  '明年',
  '去年',
  '前年',
  '年初',
  '年底',
  '今年年底',
  '去年年底',
  '第一季度',
  '第二季度',
  '第三季度',
  '第四季度',
  '一季度',
  '二季度',
  '三季度',
  '四季度',
  '最近',
  '刚才',
  '刚刚',
  '马上',
  '立刻',
  '现在',
  '目前',
  '当前',
  '这几天',
  '近期',
  '上次',
  '上回',
  '那一次',
  '那回',
  '以前',
  '之前',
  '曾经',
  '过去',
  '从前',
  '下次',
  '接下来',
  '以后',
  '待会',
  '回头',
  'today',
  'tomorrow',
  'yesterday',
  'tonight',
  'last night',
  'this morning',
  'this week',
  'next week',
  'last week',
  'weekend',
  'this month',
  'next month',
  'last month',
  'this year',
  'next year',
  'last year',
  'year to date',
  'ytd',
  'recently',
  'recent',
  'lately',
  'earlier',
  'previously',
  'before',
  'after',
  'since',
  'until',
  'upcoming',
  'coming up',
  'past few',
  'few days',
  'couple of',
  'days ago',
  'weeks ago',
  'months ago',
  'years ago',
  'ago',
  'last',
  'next',
  'previous',
  'current',
]

/**
 * Words that say WHAT KIND OF THING. Nearly every question is about a "meeting"
 * or a "schedule", so these turn up in almost every question and in almost no
 * event title — keeping one guarantees a miss.
 */
const CONTAINER_WORDS = [
  '会议记录',
  '的会议',
  '的日程',
  '的安排',
  '行程表',
  '安排表',
  '日程表',
  '会议',
  '日程',
  '安排',
  '活动',
  '事件',
  '计划',
  '记录',
  '预约',
  '清单',
  '找一下',
  '找找',
  '查找',
  '搜索',
  '搜一下',
  '搜搜',
  '查询',
  '查看',
  '看一下',
  '看看',
  '帮我',
  '我想知道',
  '我想',
  '我要',
  '告诉我',
  '有没有',
  '有没',
  '是不是',
  '什么',
  '哪个',
  '哪些',
  '一次',
  '一下',
  '所有的',
  '全部',
  '所有',
  'meeting',
  'meetings',
  'schedule',
  'schedules',
  'event',
  'events',
  'appointment',
  'appointments',
  'plan',
  'plans',
  'record',
  'records',
  'entry',
  'entries',
  'my',
  'our',
  'the',
  'a',
  'an',
  'of',
  'for',
  'to',
  'about',
  'with',
  'and',
  'find',
  'search',
  'show',
  'list',
  'all',
  'any',
  'some',
  'please',
  'me',
]

/**
 * Single characters that carry no subject, so a bigram across one is noise: 去东
 * is not a word, 东京 is. Kept short on purpose — a character that can be part
 * of a place or a topic (上, 下, 大, 小, 多, 少, 中) has to stay usable.
 */
const FUNCTION_CHARS = new Set(
  [
    ...'的了着过在和与跟给为就都也很更再又只把被从向往并且以及这那些吗呢吧啊呀哦',
    ...'我你他她它们咱您',
  ].filter((ch) => ch.length === 1),
)

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
- Omit a filter the user did not state rather than guessing one. A too-narrow query returns nothing, and nothing looks like "you never had that meeting".
- If your words return nothing, the app retries with a LOOSER span and tells the user it did. So put your single best span in query — the most distinctive words the user used — rather than a broad phrase that matches half the calendar.${previous}`
}
