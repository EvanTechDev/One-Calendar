import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  ApiError,
  fetchJson,
  messageOr,
} from '@zntr/ui/calendar/lib/fetch-json'

/**
 * `fetchJson` is the wrapper every client mutation goes through, and it used
 * to raise an unhandled rejection on every failed GET: the in-flight cleanup
 * was attached with `.finally()`, which builds a *second* promise from the
 * first. A rejected request rejects that derived promise too, and nothing was
 * holding it. These tests pin the behaviour that fix depends on — a failed GET
 * rejects only the promise the caller holds.
 */

const originalFetch = globalThis.fetch

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('fetchJson', () => {
  it('returns the parsed body on success', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ ok: true })) as never

    await expect(fetchJson<{ ok: boolean }>('/api/thing')).resolves.toEqual({
      ok: true,
    })
  })

  it('deduplicates a concurrent GET into one request', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ n: 1 }))
    globalThis.fetch = fetchMock as never

    const [a, b] = await Promise.all([
      fetchJson<{ n: number }>('/api/dedupe'),
      fetchJson<{ n: number }>('/api/dedupe'),
    ])

    expect(a).toEqual({ n: 1 })
    expect(b).toEqual({ n: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not deduplicate writes', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ n: 1 }))
    globalThis.fetch = fetchMock as never

    await fetchJson('/api/dedupe', { method: 'POST' })
    await fetchJson('/api/dedupe', { method: 'POST' })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('surfaces the API error field as the message', async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ error: 'this repeat rule cannot be moved' }, 400),
    ) as never

    await expect(fetchJson('/api/events')).rejects.toMatchObject({
      message: 'this repeat rule cannot be moved',
      status: 400,
      hasServerMessage: true,
    })
  })

  it('falls back to the status when the body is not JSON', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json')
      },
    })) as never

    await expect(fetchJson('/api/events')).rejects.toMatchObject({
      message: 'Request failed: 502',
      status: 502,
      hasServerMessage: false,
    })
  })

  it('falls back to the status when the body carries no error field', async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ somethingElse: true }, 500),
    ) as never

    await expect(fetchJson('/api/events')).rejects.toMatchObject({
      message: 'Request failed: 500',
      hasServerMessage: false,
    })
  })

  it('releases the dedup slot after a failure, so the next GET retries', async () => {
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
    globalThis.fetch = fetchMock as never

    await expect(fetchJson('/api/retry')).rejects.toThrow('boom')
    // A leaked slot would hand back the dead promise instead of refetching.
    await expect(fetchJson('/api/retry')).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not raise an unhandled rejection when a GET fails', async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ error: 'boom' }, 500),
    ) as never

    // The regression this guards: a derived promise from `.finally()` with no
    // rejection handler. Vitest fails the run on an unhandled rejection, and
    // the cleanup runs on a later microtask, so drain the queue before asserting.
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => unhandled.push(reason)
    process.on('unhandledRejection', onUnhandled)
    try {
      await expect(fetchJson('/api/unhandled')).rejects.toThrow('boom')
      await new Promise((resolve) => setTimeout(resolve, 10))
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }

    expect(unhandled).toEqual([])
  })
})

describe('messageOr', () => {
  it('prefers the server message when there was one', () => {
    expect(messageOr(new ApiError('Forbidden', 403, true), 'fallback')).toBe(
      'Forbidden',
    )
  })

  it('falls back when the server never explained itself', () => {
    expect(
      messageOr(new ApiError('Request failed: 500', 500, false), 'fallback'),
    ).toBe('fallback')
  })

  it('falls back for a transport error that is not an ApiError', () => {
    expect(messageOr(new TypeError('Failed to fetch'), 'fallback')).toBe(
      'fallback',
    )
  })

  it('falls back for a non-Error throw', () => {
    expect(messageOr('something odd', 'fallback')).toBe('fallback')
  })
})
