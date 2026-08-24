// @vitest-environment node
/**
 * The CAPTCHA gate on sign-in and sign-up.
 *
 * Turnstile is optional. The client omits the widget when
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is absent and therefore sends an empty token;
 * the server used to reject that unconditionally, so any deployment without the
 * site key returned 400 "CAPTCHA required" for every login and nobody could
 * sign in. The two sides now agree: no secret configured means no CAPTCHA.
 *
 * These tests pin both directions — that a configured deployment still enforces,
 * and that an unconfigured one does not lock users out.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Each test re-imports the route so `isTurnstileConfigured` re-reads the stubbed
// env. That first import pulls in Better Auth's module graph, which can exceed
// the default 5s timeout when the full suite is running in parallel — it passes
// comfortably in isolation. The cost is import time, not test logic.
vi.setConfig({ testTimeout: 30_000 })

const authApi = vi.hoisted(() => ({
  handler: vi.fn(async () => new Response(null, { status: 200 })),
  getSession: vi.fn(async () => null),
}))

const turnstile = vi.hoisted(() => ({ verify: vi.fn() }))

vi.mock('@zntr/auth', () => ({
  toNextJsHandler: () => ({ GET: authApi.handler, POST: authApi.handler }),
}))

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: authApi.getSession } },
}))

vi.mock('@/lib/turnstile', async () => {
  // Real isTurnstileConfigured, so the env-driven decision is exercised rather
  // than mocked away — that decision is the whole point of this file.
  const actual =
    await vi.importActual<typeof import('@/lib/turnstile')>('@/lib/turnstile')
  return { ...actual, verifyTurnstile: turnstile.verify }
})

vi.mock('@/lib/cache/session', () => ({
  invalidateCachedSession: vi.fn(async () => {}),
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

function signInRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetModules()
  authApi.handler.mockClear()
  turnstile.verify.mockReset()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('with Turnstile NOT configured', () => {
  beforeEach(() => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
  })

  it('allows sign-in with no token at all', async () => {
    // The exact request the client sends when it never rendered a widget.
    const { POST } = await import('@/app/api/auth/[...all]/route')
    const res = await POST(
      signInRequest({ email: 'a@example.com', password: 'pw' }),
    )

    expect(res.status).toBe(200)
    expect(authApi.handler).toHaveBeenCalledTimes(1)
  })

  it('allows sign-in with an empty token', async () => {
    const { POST } = await import('@/app/api/auth/[...all]/route')
    const res = await POST(
      signInRequest({
        email: 'a@example.com',
        password: 'pw',
        turnstileToken: '',
      }),
    )
    expect(res.status).toBe(200)
  })

  it('never calls Cloudflare', async () => {
    const { POST } = await import('@/app/api/auth/[...all]/route')
    await POST(signInRequest({ email: 'a@example.com', password: 'pw' }))
    expect(turnstile.verify).not.toHaveBeenCalled()
  })

  it('warns, so a deployment that lost the variable is discoverable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { POST } = await import('@/app/api/auth/[...all]/route')
    await POST(signInRequest({ email: 'a@example.com', password: 'pw' }))
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Turnstile is not configured'),
      expect.anything(),
    )
  })

  it('allows sign-up with no token', async () => {
    const { POST } = await import('@/app/api/auth/[...all]/route')
    const res = await POST(
      new Request('http://localhost/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'b@example.com', password: 'pw' }),
      }),
    )
    expect(res.status).toBe(200)
  })
})

describe('with Turnstile configured', () => {
  beforeEach(() => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'a-real-secret')
  })

  it('still rejects a missing token', async () => {
    const { POST } = await import('@/app/api/auth/[...all]/route')
    const res = await POST(
      signInRequest({ email: 'a@example.com', password: 'pw' }),
    )

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'CAPTCHA required' })
    expect(authApi.handler).not.toHaveBeenCalled()
  })

  it('still rejects a token Cloudflare refuses', async () => {
    turnstile.verify.mockResolvedValue({ success: false })
    const { POST } = await import('@/app/api/auth/[...all]/route')
    const res = await POST(
      signInRequest({
        email: 'a@example.com',
        password: 'pw',
        turnstileToken: 'bad',
      }),
    )

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'CAPTCHA verification failed' })
    expect(authApi.handler).not.toHaveBeenCalled()
  })

  it('accepts a valid token', async () => {
    turnstile.verify.mockResolvedValue({ success: true })
    const { POST } = await import('@/app/api/auth/[...all]/route')
    const res = await POST(
      signInRequest({
        email: 'a@example.com',
        password: 'pw',
        turnstileToken: 'good',
      }),
    )

    expect(res.status).toBe(200)
    expect(turnstile.verify).toHaveBeenCalledWith('good', 'login')
    expect(authApi.handler).toHaveBeenCalledTimes(1)
  })

  it('returns 503 when Cloudflare is unreachable', async () => {
    // Configured but unreachable must NOT fall open — that would let the
    // optional-CAPTCHA path be triggered by breaking the network.
    turnstile.verify.mockRejectedValue(new Error('network down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { POST } = await import('@/app/api/auth/[...all]/route')
    const res = await POST(
      signInRequest({
        email: 'a@example.com',
        password: 'pw',
        turnstileToken: 'good',
      }),
    )

    expect(res.status).toBe(503)
    expect(authApi.handler).not.toHaveBeenCalled()
  })

  it('uses the register action for sign-up', async () => {
    turnstile.verify.mockResolvedValue({ success: true })
    const { POST } = await import('@/app/api/auth/[...all]/route')
    await POST(
      new Request('http://localhost/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'b@example.com',
          password: 'pw',
          turnstileToken: 'good',
        }),
      }),
    )
    expect(turnstile.verify).toHaveBeenCalledWith('good', 'register')
  })
})

describe('routes with no CAPTCHA gate', () => {
  it('does not gate sign-out even when configured', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'a-real-secret')
    const { POST } = await import('@/app/api/auth/[...all]/route')
    const res = await POST(
      new Request('http://localhost/api/auth/sign-out', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    )
    expect(res.status).toBe(200)
    expect(turnstile.verify).not.toHaveBeenCalled()
  })
})
