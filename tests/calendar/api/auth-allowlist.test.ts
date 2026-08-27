// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  rateAllowed: true,
  retryAfter: 17,
}))

const mocks = vi.hoisted(() => ({
  handler: vi.fn(async () => new Response('delegated', { status: 200 })),
  invalidate: vi.fn(async () => {}),
  limiter: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
}))

vi.mock('@zntr/auth', () => ({
  toNextJsHandler: () => ({ GET: mocks.handler, POST: mocks.handler }),
}))

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn(async () => null) } },
}))

vi.mock('@/lib/cache/session', () => ({
  invalidateCachedSession: mocks.invalidate,
  sessionTokenFromCookieHeader: () => 'session-token',
}))

vi.mock('@/lib/drizzle/client', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
    }),
  }),
}))

vi.mock('@/lib/evlog', () => ({
  anonymousAuditActor: { type: 'anonymous' },
  withEvlog: (handler: unknown) => handler,
  useLogger: () => ({ audit: vi.fn() }),
}))

vi.mock('@/lib/turnstile', () => ({
  captchaIsGuarded: () => false,
  isTurnstileConfigured: () => false,
  verifyTurnstile: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkFixedWindowLimit: mocks.limiter,
  clientIpFrom: () => '203.0.113.8',
  rateLimitedResponse: (retryAfter: number) =>
    Response.json(
      { error: 'Too many requests', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    ),
}))

const { GET, POST } = await import('@/app/api/auth/[...all]/route')

function request(method: 'GET' | 'POST', path: string) {
  return new Request(`https://calendar.example${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      cookie: 'better-auth.session_token=session-token',
    },
    ...(method === 'POST' ? { body: '{}' } : {}),
  })
}

beforeEach(() => {
  mocks.handler.mockClear()
  mocks.invalidate.mockClear()
  mocks.limiter.mockReset()
  mocks.limiter.mockImplementation(async () => ({
    allowed: state.rateAllowed,
    retryAfter: state.retryAfter,
  }))
  state.rateAllowed = true
  state.retryAfter = 17
})

describe('calendar auth surface', () => {
  it('delegates shared GET and POST endpoints', async () => {
    expect((await GET(request('GET', '/api/auth/get-session'))).status).toBe(
      200,
    )
    expect(
      (await POST(request('POST', '/api/auth/change-password'))).status,
    ).toBe(200)
    expect(mocks.handler).toHaveBeenCalledTimes(2)
  })

  it('returns 404 for plugin-like unknown routes without delegation', async () => {
    const response = await POST(request('POST', '/api/auth/admin/create-user'))

    expect(response.status).toBe(404)
    expect(mocks.handler).not.toHaveBeenCalled()
    expect(mocks.limiter).not.toHaveBeenCalled()
  })

  it('rate limits credential routes before delegation', async () => {
    state.rateAllowed = false
    const response = await POST(request('POST', '/api/auth/sign-in/email'))

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('17')
    expect(mocks.handler).not.toHaveBeenCalled()
    expect(mocks.limiter).toHaveBeenCalledWith({
      name: 'auth:sign-in/email',
      subject: '203.0.113.8',
      limit: 10,
      windowSeconds: 60,
    })
  })

  it('does not apply an address budget to authenticated mutations', async () => {
    const response = await POST(request('POST', '/api/auth/change-password'))

    expect(response.status).toBe(200)
    expect(mocks.limiter).not.toHaveBeenCalled()
  })

  it('invalidates the session cache after successful sign-out', async () => {
    const response = await POST(request('POST', '/api/auth/sign-out'))

    expect(response.status).toBe(200)
    expect(mocks.invalidate).toHaveBeenCalledWith('session-token')
  })
})
