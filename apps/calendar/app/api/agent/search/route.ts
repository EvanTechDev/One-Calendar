import { NextResponse, type NextRequest } from 'next/server'
import { generateObject } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import {
  buildRerankInstructions,
  rerankCandidates,
  searchJudgmentsSchema,
} from '@zntr/agent/search-rerank'
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

/** All candidates are judged before paging; subsequent pages reuse sealed decisions. */
export async function POST(request: NextRequest) {
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
      const { object } = await generateObject({
        model,
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
      const candidates = await collectSearchCandidates(toolkit, query, signal)
      const categoryNames = new Map(categories.map((c) => [c.id, c.name]))
      events = await rerankCandidates(
        candidates,
        query.order,
        async (batch) => {
          const { object: judgments } = await generateObject({
            model,
            abortSignal: signal,
            schema: searchJudgmentsSchema,
            system: buildRerankInstructions(intent, query),
            prompt: JSON.stringify(
              batch.map((event) => ({
                ...event,
                category: event.categoryId
                  ? (categoryNames.get(event.categoryId) ?? null)
                  : null,
              })),
            ),
          })
          return judgments.judgments
        },
        signal,
      )
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
    return NextResponse.json(
      { error: 'Could not search your calendar' },
      { status: 502 },
    )
  }
}
