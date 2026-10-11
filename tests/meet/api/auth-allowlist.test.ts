import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Meet's auth surface.
 *
 * This used to allow exactly two endpoints and assert that sign-in and sign-up
 * were BLOCKED — correct while meet had no sign-in surface and the calendar's
 * route was the only one carrying bot verification.
 *
 * Meet mounts the shared forms now, so the surface is wider (ADR 0022). It is
 * still an allowlist, and these tests hold the boundary: Better Auth mounts a
 * route per plugin, and a pass-through would hand this app a public endpoint every
 * time a dependency grew one.
 *
 * BotID is NOT tested here. It is verified by the shared Better Auth captcha
 * plugin inside the delegated handler, on the same paths the calendar uses, and
 * `tests/auth/bot-id.test.ts` drives that plugin's `onRequest` directly. A mock
 * of `@zntr/auth` replaces the whole handler, so any bot assertion made through
 * this route would only be asserting that the mock is not the real thing.
 */
const { handled, limiter } = vi.hoisted(() => ({
  handled: vi.fn(() => new Response('delegated', { status: 200 })),
  limiter: vi.fn(async () => ({ allowed: true, retryAfter: 11 })),
}))

vi.mock('@zntr/auth', () => ({
  toNextJsHandler: () => ({ GET: handled, POST: handled }),
}))
vi.mock('@/lib/auth', () => ({ getAuth: () => ({}) }))
vi.mock('@/lib/rate-limit', () => ({
  checkFixedWindowLimit: limiter,
  clientAddress: () => '203.0.113.1',
}))

const { GET, POST } = await import('@/app/api/auth/[...all]/route')

function req(path: string, body?: unknown) {
  return new Request(`https://meet.example.com${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: { 'content-type': 'application/json' },
        }),
  }) as never
}

beforeEach(() => {
  handled.mockClear()
  limiter.mockReset().mockImplementation(async () => ({
    allowed: true,
    retryAfter: 11,
  }))
})

describe('meet auth surface', () => {
  it('allows the session read', async () => {
    expect((await GET(req('/api/auth/get-session'))).status).toBe(200)
  })

  it('allows sign-out, which deletes the session inside Better Auth', async () => {
    expect((await POST(req('/api/auth/sign-out', {}))).status).toBe(200)
  })

  it('allows sign-in, which it used to block', async () => {
    // The reason it was blocked was the missing bot check, which now lives in
    // @zntr/auth and runs here too.
    expect((await POST(req('/api/auth/sign-in/email', {}))).status).toBe(200)
  })

  it('allows sign-up', async () => {
    expect((await POST(req('/api/auth/sign-up/email', {}))).status).toBe(200)
  })

  it('allows recovery', async () => {
    expect((await POST(req('/api/auth/forget-password', {}))).status).toBe(200)
    expect(
      (await POST(req('/api/auth/request-password-reset', {}))).status,
    ).toBe(200)
    expect((await POST(req('/api/auth/reset-password', {}))).status).toBe(200)
  })

  it('allows the OTP endpoints the shared forms call', async () => {
    for (const path of [
      'email-otp/send-verification-otp',
      'email-otp/verify-email',
      'email-otp/request-email-change',
      'email-otp/change-email',
    ]) {
      expect((await POST(req(`/api/auth/${path}`, {}))).status).toBe(200)
    }
  })

  it('allows the account mutations the panel performs', async () => {
    expect((await POST(req('/api/auth/update-user', {}))).status).toBe(200)
    expect((await POST(req('/api/auth/change-password', {}))).status).toBe(200)
  })

  it('still blocks everything else with a 404', async () => {
    // 404 rather than 403: do not advertise which routes exist.
    for (const path of [
      'admin/create-user',
      'admin/set-role',
      'admin/list-users',
      'api-key/create',
      'oauth2/authorize',
      'oauth2/token',
      'oauth2/register',
      'device/code',
    ]) {
      const response = await POST(req(`/api/auth/${path}`, {}))
      expect(response.status).toBe(404)
    }
    expect(handled).not.toHaveBeenCalled()
    // A route this app does not expose is not a route anyone can burn a budget
    // on, so it must not reach the counter either.
    expect(limiter).not.toHaveBeenCalled()
  })

  it('does not accept sign-out over GET', async () => {
    // A GET sign-out means any link logs the user out, including a prefetch.
    expect((await GET(req('/api/auth/sign-out'))).status).toBe(404)
  })

  it('matches the whole remainder, not a prefix', async () => {
    expect((await POST(req('/api/auth/sign-outx', {}))).status).toBe(404)
    expect((await POST(req('/api/auth/sign-out/extra', {}))).status).toBe(404)
  })
})

describe('rate limiting', () => {
  it('counts a credential request against the address budget', async () => {
    expect((await POST(req('/api/auth/sign-in/email', {}))).status).toBe(200)
    expect(limiter).toHaveBeenCalledWith({
      name: 'auth:sign-in/email',
      subject: '203.0.113.1',
      limit: 10,
      windowSeconds: 60,
    })
  })

  it('throttles before the request reaches Better Auth', async () => {
    limiter.mockImplementation(async () => ({ allowed: false, retryAfter: 23 }))
    const response = await POST(req('/api/auth/sign-up/email', {}))

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('23')
    expect(handled).not.toHaveBeenCalled()
  })

  it('throttles a mail-sending endpoint, which costs our domain reputation', async () => {
    expect(
      (await POST(req('/api/auth/request-password-reset', {}))).status,
    ).toBe(200)
    expect(limiter).toHaveBeenCalledWith({
      name: 'auth:request-password-reset',
      subject: '203.0.113.1',
      limit: 3,
      windowSeconds: 300,
    })
  })

  it('does not spend a budget on an authenticated mutation', async () => {
    // The session is already the barrier; a challenge adds friction without
    // adding anything an attacker has to cross.
    expect((await POST(req('/api/auth/change-password', {}))).status).toBe(200)
    expect(limiter).not.toHaveBeenCalled()
  })
})
