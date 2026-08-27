import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  checkFixedWindowLimit,
  clientIpFrom,
  rateLimitedResponse,
} from '@/lib/rate-limit'

const fake = vi.hoisted(() => {
  const counters = new Map<string, number>()
  const expire = vi.fn(async () => 1)
  const incr = vi.fn(async (key: string) => {
    const next = (counters.get(key) ?? 0) + 1
    counters.set(key, next)
    return next
  })
  return {
    counters,
    incr,
    expire,
    failOpen: { value: false },
  }
})

vi.mock('@/lib/cache/client', () => ({
  withRedis: async <T>(
    fn: (redis: unknown) => Promise<T>,
    fallback: () => Promise<T>,
  ): Promise<T> => {
    if (fake.failOpen.value) return fallback()
    return fn({ incr: fake.incr, expire: fake.expire })
  },
}))

const OPTS = { name: 'test', subject: 'a', limit: 3, windowSeconds: 60 }

describe('checkFixedWindowLimit', () => {
  beforeEach(() => {
    fake.counters.clear()
    fake.incr.mockClear()
    fake.expire.mockClear()
    fake.failOpen.value = false
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:10Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows calls up to the limit', async () => {
    for (let i = 0; i < OPTS.limit; i++) {
      const result = await checkFixedWindowLimit(OPTS)
      expect(result.allowed).toBe(true)
    }
  })

  it('blocks the call past the limit', async () => {
    for (let i = 0; i < OPTS.limit; i++) await checkFixedWindowLimit(OPTS)
    const result = await checkFixedWindowLimit(OPTS)
    expect(result.allowed).toBe(false)
  })

  it('sets the expiry exactly once per window', async () => {
    for (let i = 0; i < 5; i++) await checkFixedWindowLimit(OPTS)
    expect(fake.expire).toHaveBeenCalledTimes(1)
    expect(fake.expire).toHaveBeenCalledWith(expect.any(String), 120)
  })

  it('fails open when Redis is unavailable', async () => {
    fake.failOpen.value = true
    for (let i = 0; i < 10; i++) {
      const result = await checkFixedWindowLimit(OPTS)
      expect(result.allowed).toBe(true)
    }
  })

  it('fails closed for persistent anonymous writes when Redis is unavailable', async () => {
    fake.failOpen.value = true

    const result = await checkFixedWindowLimit({ ...OPTS, failClosed: true })

    expect(result.allowed).toBe(false)
  })

  it('does not share a budget across subjects', async () => {
    for (let i = 0; i < OPTS.limit + 1; i++) {
      await checkFixedWindowLimit({ ...OPTS, subject: 'a' })
    }
    const other = await checkFixedWindowLimit({ ...OPTS, subject: 'b' })
    expect(other.allowed).toBe(true)
  })

  it('does not share a budget across names', async () => {
    for (let i = 0; i < OPTS.limit + 1; i++) {
      await checkFixedWindowLimit({ ...OPTS, name: 'one' })
    }
    const other = await checkFixedWindowLimit({ ...OPTS, name: 'two' })
    expect(other.allowed).toBe(true)
  })

  it('reports a retryAfter within the window', async () => {
    const result = await checkFixedWindowLimit(OPTS)
    expect(result.retryAfter).toBeGreaterThan(0)
    expect(result.retryAfter).toBeLessThanOrEqual(OPTS.windowSeconds)
  })

  it('starts a fresh budget in the next window', async () => {
    for (let i = 0; i < OPTS.limit + 1; i++) {
      await checkFixedWindowLimit(OPTS)
    }
    vi.setSystemTime(new Date('2026-01-01T00:01:10Z'))
    const result = await checkFixedWindowLimit(OPTS)
    expect(result.allowed).toBe(true)
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
