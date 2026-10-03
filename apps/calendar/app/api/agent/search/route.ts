import { NextResponse, type NextRequest } from 'next/server'
import { generateObject } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import {
  buildSearchAttempts,
  buildSearchInstructions,
  buildSearchPlan,
  hasAnyFilter,
  needleCandidates,
  resolvePreset,
  searchQuerySchema,
  sanitizeSearchQuery,
  summarizeProviderError,
  type AgentEventPage,
  type CalendarPreset,
  type SearchAttempt,
  type SearchQuery,
} from '@zntr/agent'
import { createAppToolkit } from '@/lib/agent/toolkit'
import { getAuthedUser } from '@/lib/api-helpers'
import { checkFixedWindowLimit, rateLimitedResponse } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_TEXT_LENGTH = 500

/** One page of results. 50 is the MCP tool's own default page size. */
const PAGE_SIZE = 50

/** A ceiling on paging so a client cannot spin through a decade of history. */
const MAX_PAGE = 20

/**
 * Semantic search for the command palette.
 *
 * The model does not search, and it does not answer: it returns ONE structured
 * query, and this route runs it against the same MCP tool functions the chat
 * agent uses. That is the whole design — a search that showed its reasoning
 * would have to be a conversation, and a conversation about "the meeting with
 * Alex" invites a second round trip per question. Prose is structurally
 * impossible here: the model never writes any, and the rows in the response are
 * real rows read from the user's own database.
 *
 * Paging does not call the model at all: the client sends back the query this
 * route resolved last time, so "load the next 50" costs one database read.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: 'The AI assistant is not configured (GROQ_API_KEY missing)' },
      { status: 503 },
    )
  }

  // Its own bucket: a search is a whole-palette gesture, not a keystroke, so
  // this can afford to be much tighter than the chat agent's.
  const rate = await checkFixedWindowLimit({
    name: 'agent-search',
    subject: user.id,
    limit: 10,
    windowSeconds: 60,
  })
  if (!rate.allowed) {
    return rateLimitedResponse(rate.retryAfter)
  }

  const body = (await request.json().catch(() => null)) as {
    text?: unknown
    previousQuery?: SearchQuery
    resolved?: SearchQuery
    page?: unknown
  } | null
  const page =
    typeof body?.page === 'number' && Number.isFinite(body.page)
      ? Math.min(Math.max(Math.trunc(body.page), 1), MAX_PAGE)
      : 1
  const text = typeof body?.text === 'string' ? body.text.trim() : ''

  // A page request carries the query this route already resolved. Trusting the
  // client's copy is safe — it is the same user's own search, and it only ever
  // narrows what that user may read — and it is what makes paging free.
  const paging = page > 1 && isSearchQuery(body?.resolved)

  if (!paging && (!text || text.length > MAX_TEXT_LENGTH)) {
    return NextResponse.json({ error: 'Invalid text' }, { status: 400 })
  }

  const toolkit = createAppToolkit(user.id)
  const [categories, timezone] = await Promise.all([
    toolkit.listCategories(),
    toolkit.getTimezone(),
  ])

  let query: SearchQuery
  if (paging) {
    query = body!.resolved!
  } else {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
    const model = groq(process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b')
    try {
      const { object } = await generateObject({
        model,
        schema: searchQuerySchema,
        system: buildSearchInstructions({
          timezone,
          nowIso: new Date().toISOString(),
          categories,
          previousQuery: body?.previousQuery,
          lastUserText: text,
        }),
        prompt: text,
      })
      query = sanitizeSearchQuery(object, { categories })
    } catch (error) {
      // Never the SDK error object: it carries the request body, and with it
      // the user's own text.
      const failure = summarizeProviderError(error)
      console.error(
        `[agent-search] groq ${failure.status ?? 'no-status'} ${failure.kind}: ${failure.detail}`,
      )
      return NextResponse.json(
        { error: 'Could not search your calendar' },
        { status: 502 },
      )
    }
  }

  const now = new Date()

  // The words to search for, derived from what the user actually TYPED as well
  // as from what the model extracted. The model picks one span and gets it
  // wrong often enough to matter ("trip" for 上次去东京旅游), and the English
  // part of a Chinese question is a translation, not a substring of anything
  // the user wrote — so the typed text gets its own candidates and the search
  // loosens the words rather than dropping them.
  const needles = paging
    ? query.query
      ? [query.query]
      : []
    : needleCandidates(text, query.query)

  // An all-null query is the one thing the model must never return, and if it
  // does the range it would otherwise leave open makes `listEvents` return the
  // user's ENTIRE history, first page, oldest first. Same for a question with
  // no dates and no searchable words in it ("公司今年第二季度报告" reduces to
  // nothing after the time words are stripped). Bounding it to a season is the
  // difference between "here is what you might have meant" and "here is your
  // life", and the client says which window it used.
  let defaultedRange = false
  const ranged = resolveQueryRange(query, timezone, now)
  if (
    !hasAnyFilter(query) ||
    (needles.length === 0 && !ranged.start && !ranged.end)
  ) {
    query = { ...query, preset: 'last_90_days' }
    defaultedRange = true
  }

  // Filters widen on the outside, words loosen on the inside: for each way of
  // giving up a filter, every candidate phrase in turn. See buildSearchPlan for
  // the order and why it is safe, and buildSearchAttempts for why a dropped
  // phrase never becomes a dropped keyword.
  const attempts = buildSearchAttempts(
    buildSearchPlan(query, resolveQueryRange(query, timezone, now)),
    needles,
    { strict: paging },
  )
  let attempt = attempts[0]
  let result = await runAttempt(toolkit, attempt, timezone, page, now)
  for (const next of attempts.slice(1)) {
    // Only the strictest search widens; page 2 of a widened search would show
    // rows that are not the rows the earlier pages were paging through.
    if (result.total > 0 || page > 1) break
    attempt = next
    result = await runAttempt(toolkit, attempt, timezone, page, now)
  }

  return NextResponse.json({
    // Echoed so the client can page without paying for the model again — and
    // echoed as the ATTEMPT that produced these rows, not the query the model
    // first wrote: paging has to continue through the same search, or page 2
    // would list the strict query's rows under page 1's relaxed heading.
    query: attempt.query,
    // With the RESOLVED instants, not the preset name: "last_year" means
    // nothing to a user, two dates mean exactly what was searched.
    range: resolveQueryRange(attempt.query, timezone, now),
    defaultedRange,
    // Which filter gave up its place for these rows, so the client can say so
    // instead of the user wondering why the answer is wider than the question.
    relaxed: attempt.relaxed,
    results: result.events.map((event) => ({
      id: event.id,
      title: event.title,
      startDate: event.startDate,
      endDate: event.endDate,
      isAllDay: event.isAllDay,
      location: event.location ?? null,
      color: event.color ?? null,
    })),
    page: result.page,
    total: result.total,
    totalPages: result.totalPages,
    hasMore: result.page < result.totalPages,
  })
}

/**
 * One attempt of the plan.
 *
 * The range resolves per attempt rather than once up front: dropping
 * `start`/`end` changes what an open-ended `past`/`upcoming` even means, so an
 * attempt that widened past the original instants has to resolve its own.
 */
async function runAttempt(
  toolkit: ReturnType<typeof createAppToolkit>,
  attempt: SearchAttempt,
  timezone: string,
  page: number,
  now: Date,
): Promise<AgentEventPage> {
  const range = resolveQueryRange(attempt.query, timezone, now)
  // Oldest first only for a CLOSED window that is entirely behind the user
  // ("last year's meetings" should start in January, not in December). An
  // open-ended range is not a window at all — `past` with no start means the
  // whole past — and sorting that ascending buries the last trip under the 50
  // oldest events the user ever had. Those get newest first, which is also
  // what "next trip" wants while the window can still contain the future.
  const ascending =
    range.start !== undefined &&
    range.end !== undefined &&
    new Date(range.end).getTime() <= now.getTime()
  return toolkit.listEvents({
    start: range.start,
    end: range.end,
    query: attempt.query.query,
    ...(attempt.query.names?.length
      ? { participants: { names: attempt.query.names } }
      : {}),
    categoryIds: attempt.query.categoryIds,
    page,
    limit: PAGE_SIZE,
    sortDirection: ascending ? 'asc' : 'desc',
  })
}

/**
 * The concrete instants to query. A named preset wins over start/end — the
 * same precedence the chat tool uses, so "last month" means the same thing in
 * both places — and everything stays in one place rather than being resolved
 * twice, differently.
 */
function resolveQueryRange(
  query: SearchQuery,
  timezone: string,
  now: Date,
): { start?: string; end?: string } {
  if (query.preset) {
    // sanitizeSearchQuery already normalised this through the same alias table
    // the chat tool uses, so the union is known here — the one cast in the
    // chain, at the boundary that produced the value.
    const resolved = resolvePreset(
      query.preset as CalendarPreset,
      now,
      timezone,
    )
    if (resolved.start || resolved.end) return resolved
  }
  return { start: query.start, end: query.end }
}

/**
 * The client's copy of a query, checked structurally. It is the client's own
 * search, but its shape decides which database filter runs, so it is not
 * passed through unchecked.
 */
function isSearchQuery(value: unknown): value is SearchQuery {
  if (!value || typeof value !== 'object') return false
  const query = value as Record<string, unknown>
  const strings = ['preset', 'start', 'end', 'query']
  if (strings.some((key) => key in query && typeof query[key] !== 'string')) {
    return false
  }
  for (const key of ['names', 'categoryIds']) {
    const list = query[key]
    if (list !== undefined && !Array.isArray(list)) return false
    if (Array.isArray(list) && list.some((item) => typeof item !== 'string')) {
      return false
    }
  }
  return true
}
