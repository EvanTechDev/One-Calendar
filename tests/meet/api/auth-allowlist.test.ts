import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Meet's auth surface.
 *
 * This used to allow exactly two endpoints and assert that sign-in and sign-up
 * were BLOCKED — correct while meet had no sign-in surface and the calendar's
 * route was the only one carrying CAPTCHA verification.
 *
 * Meet mounts the shared forms now, so the surface is wider (ADR 0022). It is
 * still an allowlist, and these tests hold the boundary: Better Auth mounts a
 * route per plugin, and a pass-through would hand this app a public endpoint every
 * time a dependency grew one.
 */
const handled = vi.fn(() => new Response('delegated', { status: 200 }))

vi.mock('@zntr/auth', () => ({
  toNextJsHandler: () => ({ GET: handled, POST: handled }),
}))
vi.mock('@/lib/auth', () => ({ getAuth: () => ({}) }))
// No Redis in tests; the limiter fails open, which is its documented posture.
vi.mock('@/lib/rate-limit', () => ({
  checkFixedWindowLimit: async () => ({ allowed: true, retryAfter: 0 }),
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
  delete process.env.TURNSTILE_SECRET_KEY
})

describe('meet auth surface', () => {
  it('allows the session read', async () => {
    expect((await GET(req('/api/auth/get-session'))).status).toBe(200)
  })

  it('allows sign-out', async () => {
    expect((await POST(req('/api/auth/sign-out', {}))).status).toBe(200)
  })

  it('allows sign-in, which it used to block', async () => {
    // The reason it was blocked was the missing CAPTCHA check, which now lives in
    // @zntr/auth and runs here too.
    expect((await POST(req('/api/auth/sign-in/email', {}))).status).toBe(200)
  })

  it('allows sign-up', async () => {
    expect((await POST(req('/api/auth/sign-up/email', {}))).status).toBe(200)
  })

  it('allows recovery', async () => {
    expect((await POST(req('/api/auth/forget-password', {}))).status).toBe(200)
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

describe('CAPTCHA enforcement', () => {
  it('rejects a guarded request with no token when configured', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'a-secret'
    const response = await POST(req('/api/auth/sign-in/email', {}))
    expect(response.status).toBe(400)
    expect(handled).not.toHaveBeenCalled()
  })

  it('skips the check when Turnstile is not configured', async () => {
    // Fails open to match the client, which omits the widget with no site key.
    // Demanding a token nothing can produce would make sign-in impossible.
    const response = await POST(req('/api/auth/sign-in/email', {}))
    expect(response.status).toBe(200)
  })

  it('does not guard a session-authenticated mutation', async () => {
    // The session is already the barrier; a challenge adds friction without
    // adding anything an attacker has to cross.
    process.env.TURNSTILE_SECRET_KEY = 'a-secret'
    expect((await POST(req('/api/auth/change-password', {}))).status).toBe(200)
  })
})
