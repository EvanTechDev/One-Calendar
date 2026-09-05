import { NextResponse, type NextRequest } from 'next/server'
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { buildCalendarTools, toAiTools, buildInstructions } from '@zntr/agent'
import { createAppToolkit } from '@/lib/agent/toolkit'
import { getAuthedUser } from '@/lib/api-helpers'
import { checkFixedWindowLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_MESSAGES = 30
const MAX_TEXT_LENGTH = 4000

/**
 * The AI command palette's backend. Auth and rate limits live HERE, at the
 * boundary; the toolkit the tools close over is already user-scoped, so a
 * prompt-injected model cannot escalate past the signed-in user — exactly
 * the MCP server's posture.
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

  // Each palette question spins a multi-step tool loop against a free-tier
  // model; without a brake one stuck client exhausts the Groq quota for
  // every user on the deployment.
  const rate = await checkFixedWindowLimit({
    name: 'agent-chat',
    subject: user.id,
    limit: 20,
    windowSeconds: 300,
  })
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many requests, slow down' },
      {
        status: 429,
        headers: { 'Retry-After': String(rate.retryAfter) },
      },
    )
  }

  const body = (await request.json().catch(() => null)) as {
    messages?: UIMessage[]
  } | null
  if (!body?.messages || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Bound the transcript: the client keeps history for one palette session,
  // and an unbounded replay both blows Groq's context window and lets a
  // hostile client stuff megabytes into the prompt.
  const messages = body.messages.slice(-MAX_MESSAGES)
  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (
        part.type === 'text' &&
        typeof part.text === 'string' &&
        part.text.length > MAX_TEXT_LENGTH
      ) {
        return NextResponse.json({ error: 'Message too long' }, { status: 400 })
      }
    }
  }

  const toolkit = createAppToolkit(user.id)
  const tools = toAiTools(
    buildCalendarTools(toolkit) as unknown as Parameters<typeof toAiTools>[0],
  )
  const timezone = await toolkit.getTimezone()

  const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
  // Default: GPT-OSS 120B — Groq moved the Llama 3.3 70B model to
  // Enterprise-only, and this is the strongest tool-calling model on the
  // free/developer tier (250K TPM / 1K RPM).
  const model = groq(process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b')

  const result = streamText({
    model,
    instructions: buildInstructions({
      timezone,
      nowIso: new Date().toISOString(),
    }),
    messages: await convertToModelMessages(messages),
    tools,
    // list → decide → act → confirm needs a few steps; eight is enough for
    // any calendar task and small enough that a confused model stops fast.
    stopWhen: stepCountIs(8),
    onError({ error }) {
      console.error('[agent-chat] stream error', error)
    },
  })

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  })
}
