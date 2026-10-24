import { mock as moduleMock } from 'bun:test'
await import('./../../support/dom')
import { describe, it, expect, vi, beforeEach } from 'bun:test'

const mocks = (() => {
  const db = { handle: 'db' }
  return {
    db,
    getDb: vi.fn(() => db),
    countAgainst: vi.fn(async () => ({ allowed: true, retryAfter: 60 })),
    dropClosedCounters: vi.fn(async () => 3),
  }
})()

moduleMock.module('@/lib/drizzle/client', () => ({ getDb: mocks.getDb }))
moduleMock.module('@zntr/auth/rate-limit', () => ({
  checkFixedWindowLimit: mocks.countAgainst,
  cleanupRateLimitCounters: mocks.dropClosedCounters,
}))
const {
  checkFixedWindowLimit,
  cleanupRateLimitCounters,
  clientIpFrom,
  rateLimitedResponse,
} = await import('@/lib/rate-limit')

/**
 * The counting itself — allow up to the limit, block past it, keep concurrent
 * increments from overwriting each other — is exercised against a real database
 * in `tests/auth/rate-limit.test.ts`. What is left here is the binding: this
 * module exists only to hand the shared counter this app's database handle.
 * Nothing in it decides anything, so these cases are about wiring — a limiter
 * bound to the wrong handle still compiles, still returns a limit result, and
 * quietly counts in a table nobody reads.
 */
describe('the calendar binding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('counts against this app’s own database handle', async () => {
    const options = { name: 'test', subject: 'a', limit: 3, windowSeconds: 60 }

    await checkFixedWindowLimit(options)

    expect(mocks.getDb).toHaveBeenCalled()
    expect(mocks.countAgainst).toHaveBeenCalledWith(mocks.db, options)
  })

  it('returns the shared counter’s verdict unchanged', async () => {
    mocks.countAgainst.mockResolvedValueOnce({ allowed: false, retryAfter: 42 })

    await expect(
      checkFixedWindowLimit({
        name: 'test',
        subject: 'a',
        limit: 3,
        windowSeconds: 60,
      }),
    ).resolves.toEqual({ allowed: false, retryAfter: 42 })
  })

  it('cleans closed counters against the same handle', async () => {
    await expect(cleanupRateLimitCounters()).resolves.toBe(3)

    expect(mocks.dropClosedCounters).toHaveBeenCalledWith(mocks.db)
  })
})

describe('clientIpFrom', () => {
  const make = (headers: Record<string, string>) =>
    new Request('https://example.com/', { headers })

  it('prefers cf-connecting-ip', () => {
    expect(
      clientIpFrom(
        make({
          'cf-connecting-ip': '1.1.1.1',
          'x-forwarded-for': '2.2.2.2',
          'x-real-ip': '3.3.3.3',
        }),
      ),
    ).toBe('1.1.1.1')
  })

  it('falls back to the first x-forwarded-for entry', () => {
    expect(clientIpFrom(make({ 'x-forwarded-for': '2.2.2.2, 4.4.4.4' }))).toBe(
      '2.2.2.2',
    )
  })

  it('falls back to x-real-ip', () => {
    expect(clientIpFrom(make({ 'x-real-ip': '3.3.3.3' }))).toBe('3.3.3.3')
  })

  it('returns unknown when no header is present', () => {
    expect(clientIpFrom(make({}))).toBe('unknown')
  })
})

describe('rateLimitedResponse', () => {
  it('returns 429 with a matching Retry-After header', () => {
    const res = rateLimitedResponse(42)
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('42')
  })
})
