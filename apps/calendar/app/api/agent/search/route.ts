import { NextResponse, type NextRequest } from 'next/server'
import { generateObject } from 'ai'
import { createGroq } from '@ai-sdk/groq'
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
export const maxDuration = 30
const PAGE_SIZE = 50

/** One model compilation, one retrieval. Page requests reuse the concrete plan. */
export async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const page = body.page ?? 1
  if (!Number.isInteger(page) || page < 1 || page > 20) {
    return NextResponse.json({ error: 'Invalid page' }, { status: 400 })
  }
  const paging = page > 1
  const resolved = paging
    ? resolvedSearchQuerySchema.safeParse(body.resolved)
    : undefined
  const previous =
    body.previousQuery === undefined
      ? undefined
      : resolvedSearchQuerySchema.safeParse(body.previousQuery)
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (
    (paging && !resolved?.success) ||
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
  let query: SearchQuery
  try {
    if (resolved?.success) {
      query = resolved.data
    } else {
      const [categories, timezone] = await Promise.all([
        toolkit.listCategories(),
        toolkit.getTimezone(),
      ])
      const now = new Date()
      const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
      const { object } = await generateObject({
        model: groq(process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b'),
        schema: searchQuerySchema,
        system: buildSearchInstructions({
          timezone,
          nowIso: now.toISOString(),
          categories,
          previousQuery: previous?.success ? previous.data : undefined,
          lastUserText: text,
        }),
        prompt: text,
      })
      query = sanitizeSearchQuery(object, { categories, timezone, now })
    }
    const result = await toolkit.listEvents({
      start: query.start,
      end: query.end,
      semanticSearch: { concepts: query.concepts, order: query.order },
      participants: query.names?.length
        ? { names: query.names, mode: 'all' }
        : undefined,
      categoryIds: query.categoryIds,
      page,
      limit: PAGE_SIZE,
    })
    return NextResponse.json({
      query,
      range: { start: query.start, end: query.end },
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
      hasMore: result.page < result.totalPages && result.page < 20,
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
