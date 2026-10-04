// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { convertToModelMessages, streamText } from 'ai'

vi.mock('@/lib/api-helpers', () => ({
  getAuthedUser: async () => ({ id: 'u1' }),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkFixedWindowLimit: async () => ({ allowed: true }),
}))
vi.mock('@/lib/agent/toolkit', () => ({
  createAppToolkit: () => ({ getTimezone: async () => 'Asia/Shanghai' }),
}))
vi.mock('@ai-sdk/groq', () => ({ createGroq: () => () => 'model' }))
vi.mock('ai', async (original) => ({
  ...(await original<typeof import('ai')>()),
  streamText: vi.fn(() => ({
    stream: new ReadableStream({
      start(controller) {
        controller.close()
      },
    }),
  })),
  toUIMessageStream: ({ stream }: { stream: ReadableStream }) => stream,
  createUIMessageStreamResponse: ({ stream }: { stream: ReadableStream }) =>
    new Response(stream),
}))
import { POST } from '@/app/api/agent/chat/route'

beforeEach(() => {
  vi.stubEnv('GROQ_API_KEY', 'test')
  vi.mocked(streamText).mockClear()
})
afterEach(() => vi.unstubAllEnvs())

it('can continue a stopped tool call instead of rejecting the whole next turn', async () => {
  const messages = [
    {
      id: 'u1',
      role: 'user' as const,
      parts: [{ type: 'text' as const, text: 'Find my meetings' }],
    },
    {
      id: 'a1',
      role: 'assistant' as const,
      parts: [
        {
          type: 'tool-list_events' as const,
          toolCallId: 'call-1',
          state: 'input-available' as const,
          input: { preset: 'today' },
        },
      ],
    },
    {
      id: 'u2',
      role: 'user' as const,
      parts: [{ type: 'text' as const, text: 'Continue' }],
    },
  ]
  // Without filtering, the next provider request contains an unmatched call.
  expect(JSON.stringify(await convertToModelMessages(messages))).toContain(
    'call-1',
  )
  const response = await POST(
    new NextRequest('http://localhost/api/agent/chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }),
  )
  expect(response.status).toBe(200)
  expect(
    JSON.stringify(vi.mocked(streamText).mock.calls[0][0].messages),
  ).not.toContain('call-1')
  expect(vi.mocked(streamText).mock.calls[0][0].messages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        role: 'user',
        content: [{ type: 'text', text: 'Continue' }],
      }),
    ]),
  )
})

it('keeps approved destructive calls when cleaning an interrupted transcript', async () => {
  await POST(
    new NextRequest('http://localhost/api/agent/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          {
            id: 'u1',
            role: 'user',
            parts: [{ type: 'text', text: 'Delete the selected event' }],
          },
          {
            id: 'a1',
            role: 'assistant',
            parts: [
              {
                type: 'tool-delete_event',
                toolCallId: 'delete-1',
                state: 'approval-responded',
                input: { id: 'e1' },
                approval: { id: 'approval-1', approved: true },
              },
            ],
          },
        ],
      }),
    }),
  )
  const transcript = JSON.stringify(
    vi.mocked(streamText).mock.calls[0][0].messages,
  )
  expect(transcript).toContain('delete-1')
  expect(transcript).toContain('approval-1')
})

it('propagates cancellation and reserves a tool-free final response for unfinished work', async () => {
  const controller = new AbortController()
  const request = new NextRequest('http://localhost/api/agent/chat', {
    method: 'POST',
    signal: controller.signal,
    body: JSON.stringify({
      messages: [
        {
          id: 'u1',
          role: 'user',
          parts: [{ type: 'text', text: 'Update 12 meetings' }],
        },
      ],
    }),
  })
  await POST(request)
  const options = vi.mocked(streamText).mock.calls[0][0]
  controller.abort()
  expect(options.abortSignal?.aborted).toBe(true)
  const prepare = options.prepareStep as (input: {
    stepNumber: number
  }) => { toolChoice: string; instructions: string } | undefined
  expect(prepare({ stepNumber: 11 })).toBeUndefined()
  expect(prepare({ stepNumber: 12 })).toEqual(
    expect.objectContaining({
      toolChoice: 'none',
      instructions: expect.stringContaining('unfinished work'),
    }),
  )
  expect(options.timeout).toEqual(
    expect.objectContaining({ totalMs: 270_000, chunkMs: 45_000 }),
  )
})
