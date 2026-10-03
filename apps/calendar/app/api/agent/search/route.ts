import { NextResponse, type NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import { generateObject } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { matchSearchEvents } from '@zntr/agent/search-match'
import {
  collectSearchCandidates,
  eventStamp,
  openSearch,
  sealSearch,
} from '@/lib/agent/search-session'
import type { AgentEventSummary } from '@zntr/agent/types'
import {
  buildSearchInstructions,
  searchQuerySchema,
  sanitizeSearchQuery,
  resolvedSearchQuerySchema,
  type SearchQuery,
} from '@zntr/agent/search'
import { summarizeProviderError } from '@zntr/agent'
import { createAppToolkit } from '@/lib/agent/toolkit'
import { getAuthedUser } from '@/lib/api-helpers'
import { checkFixedWindowLimit, rateLimitedResponse } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 300
const PAGE_SIZE = 50

/** One model call compiles intent; local matching precedes stable pagination. */
export async function POST(request: NextRequest) {
  const requestId = randomUUID()
  const started = performance.now()
  let stage = 'received'
  // Stage/count metadata only: neither questions nor calendar content belong in
  // logs. Even early 401/400/503 responses must leave an observable request.
  const trace = (next: string, counts?: Record<string, number>) => {
    stage = next
    console.info('[agent-search]', {
      requestId,
      stage,
      elapsedMs: Math.round(performance.now() - started),
      ...counts,
    })
  }
  trace('received')
  let response: Response | undefined
  try {
    response = await search(request, trace)
    response.headers.set('X-Search-Request-Id', requestId)
    return response
  } finally {
    console.info('[agent-search]', {
      requestId,
      stage: 'finished',
      lastStage: stage,
      status: response?.status ?? 500,
      elapsedMs: Math.round(performance.now() - started),
    })
  }
}

async function search(
  request: NextRequest,
  trace: (stage: string, counts?: Record<string, number>) => void,
) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const page = body.page ?? 1
  if (!Number.isSafeInteger(page) || page < 1) {
    return NextResponse.json({ error: 'Invalid page' }, { status: 400 })
  }
  const paging = page > 1
  const previous =
    body.previousQuery === undefined
      ? undefined
      : resolvedSearchQuerySchema.safeParse(body.previousQuery)
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (
    (paging && typeof body.searchToken !== 'string') ||
    (previous && !previous.success) ||
    (!paging && (!text || text.length > 500))
  ) {
    return NextResponse.json({ error: 'Invalid search' }, { status: 400 })
  }
  if (!paging && !process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: 'Search is not configured' },
      { status: 503 },
    )
  }
  const rate = await checkFixedWindowLimit({
    name: 'agent-search',
    subject: user.id,
    limit: 10,
    windowSeconds: 60,
  })
  if (!rate.allowed) return rateLimitedResponse(rate.retryAfter)

  const toolkit = createAppToolkit(user.id)
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(270_000)])
  let query: SearchQuery
  try {
    let searchToken: string
    let events: AgentEventSummary[]
    if (paging) {
      trace('restore-page', { page })
      const snapshot = await openSearch(user.id, body.searchToken).catch(
        () => null,
      )
      if (!snapshot)
        return NextResponse.json(
          { error: 'Search expired; search again' },
          { status: 400 },
        )
      query = snapshot.query
      const candidates = new Map(
        (await collectSearchCandidates(toolkit, query, signal)).map((e) => [
          e.id,
          e,
        ]),
      )
      events = []
      for (const hit of snapshot.hits) {
        const event = candidates.get(hit.id)
        if (!event || eventStamp(event) !== hit.stamp) {
          return NextResponse.json(
            { error: 'Calendar changed; search again' },
            { status: 409 },
          )
        }
        events.push(event)
      }
      searchToken = body.searchToken
    } else {
      trace('load-context')
      const [categories, timezone] = await Promise.all([
        toolkit.listCategories(),
        toolkit.getTimezone(),
      ])
      const now = new Date()
      const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
      const model = groq(process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b')
      const prior = body.previousToken
        ? await openSearch(user.id, body.previousToken).catch(() => null)
        : null
      // Keep original phrasing across refinement, not just the compiler's keywords.
      const intent = prior ? `${prior.intent}\nFollow-up: ${text}` : text
      trace('compile-query')
      const { object } = await generateObject({
        model,
        // A search must not multiply provider quota failures into more requests.
        maxRetries: 0,
        abortSignal: signal,
        schema: searchQuerySchema,
        system: buildSearchInstructions({
          timezone,
          nowIso: now.toISOString(),
          categories,
          previousQuery:
            prior?.query ?? (previous?.success ? previous.data : undefined),
          lastUserText: text,
        }),
        prompt: text,
      })
      query = sanitizeSearchQuery(object, { categories, timezone, now })
      trace('collect-candidates')
      const candidates = await collectSearchCandidates(toolkit, query, signal)
      trace('candidates-collected', { candidates: candidates.length })
      const categoryNames = new Map(categories.map((c) => [c.id, c.name]))
      trace('match-candidates')
      events = matchSearchEvents(candidates, query, categoryNames)
      trace('seal-results', { matches: events.length })
      searchToken = await sealSearch(user.id, {
        query,
        intent,
        hits: events.map((event) => ({
          id: event.id,
          stamp: eventStamp(event),
        })),
      })
    }
    const totalPages = Math.ceil(events.length / PAGE_SIZE)
    return NextResponse.json({
      query,
      searchToken,
      range: { start: query.start, end: query.end },
      results: events
        .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
        .map((event) => ({
          id: event.id,
          title: event.title,
          startDate: event.startDate,
          endDate: event.endDate,
          isAllDay: event.isAllDay,
          location: event.location ?? null,
          color: event.color ?? null,
        })),
      page,
      total: events.length,
      totalPages,
      hasMore: page < totalPages,
    })
  } catch (error) {
    // Never log event data or the SDK request body.
    const failure = summarizeProviderError(error)
    console.error(
      `[agent-search] ${failure.status ?? 'no-status'} ${failure.kind}: ${failure.detail}`,
    )
    if (failure.status === 429) {
      const headers = (error as { responseHeaders?: Record<string, string> })
        .responseHeaders
      const retry = headers?.['retry-after']
      // Preserve a valid provider delay, rather than inventing a cooldown.
      return NextResponse.json(
        { error: 'Search provider rate limit reached' },
        {
          status: 429,
          headers:
            retry &&
            (/^\d+(\.\d+)?$/.test(retry) || Number.isFinite(Date.parse(retry)))
              ? { 'Retry-After': retry }
              : undefined,
        },
      )
    }
    return NextResponse.json(
      { error: 'Could not search your calendar' },
      { status: signal.aborted && !request.signal.aborted ? 504 : 502 },
    )
  }
}
