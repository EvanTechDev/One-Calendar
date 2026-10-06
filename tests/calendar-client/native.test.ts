import { afterEach, describe, expect, it, vi } from 'vitest'

const ipc = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({
  invoke: ipc.invoke,
  Channel: class {
    onmessage?: (message: unknown) => void
  },
}))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }))

import { createNativeFetch } from '../../apps/calendar-client/src/native'

const fetchNative = createNativeFetch('https://calendar.example')
type Bridge = {
  request: { id: string; path: string; headers: Record<string, string> }
  events: { onmessage: (message: unknown) => void }
}

afterEach(() => vi.resetAllMocks())

describe('native streaming request adapter', () => {
  it('returns headers before the full response and preserves streamed bytes', async () => {
    let channel!: Bridge['events']
    ipc.invoke.mockImplementation((command, args: Bridge) => {
      if (command !== 'desktop_request') return Promise.resolve()
      channel = args.events
      expect(args.request.path).toBe('/api/agent/chat')
      channel.onmessage({
        type: 'headers',
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      })
      return new Promise(() => {})
    })
    const response = await fetchNative('/api/agent/chat', {
      method: 'POST',
      body: '{}',
    })
    const reader = response.body!.getReader()
    channel.onmessage({
      type: 'chunk',
      data: Buffer.from('data: hello\n\n').toString('base64'),
    })
    expect(new TextDecoder().decode((await reader.read()).value)).toBe(
      'data: hello\n\n',
    )
    channel.onmessage({ type: 'end' })
    expect((await reader.read()).done).toBe(true)
  })

  it('propagates cancellation after headers to Rust and the response reader', async () => {
    ipc.invoke.mockImplementation((command, args: Bridge) => {
      if (command === 'desktop_request') {
        args.events.onmessage({ type: 'headers', status: 200, headers: {} })
      }
      return Promise.resolve()
    })
    const abort = new AbortController()
    const response = await fetchNative('/api/agent/chat', {
      signal: abort.signal,
    })
    const reading = response.body!.getReader().read()
    abort.abort()
    await expect(reading).rejects.toMatchObject({ name: 'AbortError' })
    expect(ipc.invoke).toHaveBeenCalledWith('desktop_cancel_request', {
      id: expect.any(String),
    })
  })

  it('does not dispatch a request that is already cancelled', async () => {
    const signal = AbortSignal.abort()
    await expect(fetchNative('/api/events', { signal })).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(ipc.invoke).not.toHaveBeenCalled()
  })

  it('preserves an HTTP error response for the shared API error boundary', async () => {
    ipc.invoke.mockImplementation((_command, args: Bridge) => {
      args.events.onmessage({
        type: 'headers',
        status: 429,
        headers: { 'retry-after': '60' },
      })
      args.events.onmessage({
        type: 'chunk',
        data: Buffer.from('{"error":"rate limited"}').toString('base64'),
      })
      args.events.onmessage({ type: 'end' })
      return Promise.resolve()
    })
    const response = await fetchNative('/api/events')
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('60')
    expect(await response.json()).toEqual({ error: 'rate limited' })
  })

  it.each(['https://attacker.example/api/events', '/sign-in'])(
    'rejects a foreign or non-API target: %s',
    async (url) => {
      await expect(fetchNative(url)).rejects.toThrow('Only calendar API')
      expect(ipc.invoke).not.toHaveBeenCalled()
    },
  )
})
