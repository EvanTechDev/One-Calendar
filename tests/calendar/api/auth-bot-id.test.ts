// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handler: vi.fn(async (request: Request) =>
    Response.json(await request.json()),
  ),
  check: vi.fn(),
  limiter: vi.fn(),
}))
vi.mock('botid/server', () => ({ checkBotId: mocks.check }))
vi.mock('@zntr/auth', () => ({
  toNextJsHandler: () => ({ GET: mocks.handler, POST: mocks.handler }),
}))
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: async () => null } },
}))
vi.mock('@/lib/cache/session', () => ({
  invalidateCachedSession: vi.fn(),
  sessionTokenFromCookieHeader: () => null,
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
  withEvlog: (fn: unknown) => fn,
  useLogger: () => ({ audit: vi.fn() }),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkFixedWindowLimit: mocks.limiter,
  clientIpFrom: () => '203.0.113.8',
  rateLimitedResponse: () => new Response(null, { status: 429 }),
}))

const { POST } = await import('@/app/api/auth/[...all]/route')
function request(path: string, body = {}) {
  return new Request(`https://calendar.example/api/auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-is-human': 'forged' },
    body: JSON.stringify(body),
  })
}
beforeEach(() => {
  mocks.handler.mockClear()
  mocks.check.mockReset().mockResolvedValue({ isBot: false })
  mocks.limiter.mockReset().mockResolvedValue({ allowed: true, retryAfter: 0 })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('Calendar API BotID enforcement', () => {
  it.each([
    'sign-in/email',
    'sign-up/email',
    'request-password-reset',
    'email-otp/request-password-reset',
    'email-otp/send-verification-otp',
  ])(
    'blocks %s before Better Auth even with a forged human header',
    async (path) => {
      mocks.check.mockResolvedValue({ isBot: true })
      expect((await POST(request(path))).status).toBe(403)
      expect(mocks.handler).not.toHaveBeenCalled()
    },
  )
  it('passes the original body to Better Auth after verification', async () => {
    const body = { email: 'ada@example.com', password: 'example password' }
    const result = await POST(request('sign-in/email', body))
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual(body)
    expect(mocks.check).toHaveBeenCalledTimes(1)
  })
  it('does not fall open during a verifier outage', async () => {
    mocks.check.mockRejectedValue(new Error('unavailable'))
    expect((await POST(request('sign-in/email'))).status).toBe(503)
    expect(mocks.handler).not.toHaveBeenCalled()
  })
  it('preserves the rate-limit gate ahead of verification', async () => {
    mocks.limiter.mockResolvedValue({ allowed: false, retryAfter: 10 })
    expect((await POST(request('sign-in/email'))).status).toBe(429)
    expect(mocks.check).not.toHaveBeenCalled()
    expect(mocks.handler).not.toHaveBeenCalled()
  })
  it.each([
    'oauth2/token',
    'desktop/exchange',
    'desktop/browser-link',
    'desktop/browser-continue',
    'sign-out',
  ])('preserves non-browser flow %s', async (path) => {
    expect((await POST(request(path))).status).toBe(200)
    expect(mocks.check).not.toHaveBeenCalled()
  })
})
