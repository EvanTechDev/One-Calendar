import { NextResponse, type NextRequest } from 'next/server'
import { generateObject } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import {
  buildParseInstructions,
  parseEventSchema,
  sanitizeParsedEvent,
  summarizeProviderError,
} from '@zntr/agent'
import { createAppToolkit } from '@/lib/agent/toolkit'
import { getAuthedUser } from '@/lib/api-helpers'
import { checkFixedWindowLimit, rateLimitedResponse } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_TEXT_LENGTH = 500

/**
 * Natural-language quick-create: the create-event popover sends the title
 * input's text here on Enter and gets back a SPARSE draft — absent fields
 * mean "the text said nothing", so the popover keeps whatever the user
 * already had. One generateObject call, no tool loop; auth and rate limits
 * live here at the boundary, same posture as the chat route.
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

  // Independent bucket from the chat agent: quick-create fires on a single
  // Enter keystroke, so a tight per-minute cap is the right shape.
  const rate = await checkFixedWindowLimit({
    name: 'agent-parse-event',
    subject: user.id,
    limit: 15,
    windowSeconds: 60,
  })
  if (!rate.allowed) {
    return rateLimitedResponse(rate.retryAfter)
  }

  const body = (await request.json().catch(() => null)) as {
    text?: unknown
  } | null
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text || text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: 'Invalid text' }, { status: 400 })
  }

  const toolkit = createAppToolkit(user.id)
  const [categories, timezone] = await Promise.all([
    toolkit.listCategories(),
    toolkit.getTimezone(),
  ])

  const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
  const model = groq(process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b')

  try {
    const { object } = await generateObject({
      model,
      schema: parseEventSchema,
      system: buildParseInstructions({
        timezone,
        nowIso: new Date().toISOString(),
        categories,
      }),
      prompt: text,
    })
    const draft = sanitizeParsedEvent(object, { categories })
    // Title is the one guaranteed field: fall back to the user's own text
    // so the popover always has something to show.
    return NextResponse.json({
      event: { ...draft, title: draft.title ?? text },
    })
  } catch (error) {
    // Model/gateway/schema failure — the popover treats this as a full
    // failure: skeletons end, the user's text stays, a toast explains. Log the
    // provider's status and its own message, never the SDK error object: that
    // dumps the request body, and with it the user's text.
    const failure = summarizeProviderError(error)
    console.error(
      `[agent-parse-event] groq ${failure.status ?? 'no-status'} ${failure.kind}: ${failure.detail}`,
    )
    return NextResponse.json(
      { error: 'Could not parse the event' },
      { status: 502 },
    )
  }
}
