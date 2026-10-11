// @vitest-environment node
/**
 * What this route owns around BotID.
 *
 * Verification is no longer the route's job. It used to call `checkBotId` and
 * answer 403 itself; it now delegates to Better Auth, whose `captcha` plugin
 * (enabled with `plugins.botId`) runs the check and returns 403
 * VERIFICATION_FAILED or 500 UNKNOWN_ERROR. That plugin is covered directly in
 * `tests/auth/bot-id.test.ts` against `plugin.onRequest`.
 *
 * So this file asserts what is left here and is this route's alone: which
 * paths are guarded, that a verification failure is recorded in the audit log
 * rather than passing through unnoticed, and that the gates in front of the
 * delegate (route policy, rate limit) short-circuit before Better Auth — and
 * before any budget is spent on a request that was never going to run.
 *
 * A bot verdict is deliberately NOT asserted through this route: `@zntr/auth`
 * is mocked here, so such a test would only assert that the mock is not the
 * real handler.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handler: vi.fn(async (request: Request) =>
    Response.json(await request.json()),
  ),
  limiter: vi.fn(),
  audit: vi.fn(),
}))
vi.mock('@zntr/auth', () => ({
  toNextJsHandler: () => ({ GET: mocks.handler, POST: mocks.handler }),
}))
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: async () => null } },
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
  useLogger: () => ({ audit: mocks.audit }),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkFixedWindowLimit: mocks.limiter,
  clientIpFrom: () => '203.0.113.8',
  rateLimitedResponse: () => new Response(null, { status: 429 }),
}))

const { POST } = await import('@/app/api/auth/[...all]/route')
const { BOT_ID_ROUTES } = await import('@zntr/auth/bot-policy')

/** Every path the captcha plugin guards, taken from the policy itself. */
const GUARDED = BOT_ID_ROUTES.map((route) =>
  route.path.replace('/api/auth/', ''),
)

function request(path: string, body = {}) {
  return new Request(`https://calendar.example/api/auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-is-human': 'forged' },
    body: JSON.stringify(body),
  })
}

/** The two shapes the captcha plugin answers a bot or an outage with. */
function verificationFailure(status: number, code: string) {
  return () => Response.json({ code }, { status })
}

beforeEach(() => {
  mocks.handler.mockClear()
  mocks.handler.mockImplementation(async (r: Request) =>
    Response.json(await r.json()),
  )
  mocks.audit.mockClear()
  mocks.limiter.mockReset().mockResolvedValue({ allowed: true, retryAfter: 0 })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('Calendar API BotID auditing', () => {
  it('names the endpoints it actually guards', () => {
    // The audit below is keyed on this list, so a path added to the plugin but
    // not seen here would fail silently — the reverse of the drift this guards.
    expect(GUARDED).toContain('sign-in/email')
    expect(GUARDED).toContain('request-password-reset')
    expect(GUARDED).not.toContain('oauth2/token')
  })

  it.each(GUARDED)('records a bot rejection on %s', async (path) => {
    mocks.handler.mockImplementationOnce(
      verificationFailure(403, 'VERIFICATION_FAILED'),
    )
    const res = await POST(request(path))
    expect(res.status).toBe(403)
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'bot.verification.fail',
        outcome: 'failure',
        target: { type: 'auth_endpoint', id: path },
      }),
    )
  })

  it('records a verifier outage the same way, since it is not a pass', async () => {
    mocks.handler.mockImplementationOnce(
      verificationFailure(500, 'UNKNOWN_ERROR'),
    )
    expect((await POST(request('sign-in/email'))).status).toBe(500)
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'bot.verification.fail' }),
    )
  })

  it('passes the captcha response through unaltered', async () => {
    const failure = Response.json(
      { code: 'VERIFICATION_FAILED' },
      { status: 403 },
    )
    mocks.handler.mockResolvedValueOnce(failure)
    expect(await POST(request('sign-in/email'))).toBe(failure)
  })

  it('does not report an ordinary auth failure as a bot', async () => {
    // A wrong password is also a 403. Blaming BotID for it would poison the
    // signal that makes the bot log worth reading.
    mocks.handler.mockImplementationOnce(
      verificationFailure(403, 'INVALID_EMAIL_OR_PASSWORD'),
    )
    await POST(request('sign-in/email'))
    expect(mocks.audit).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'bot.verification.fail' }),
    )
  })

  it('ignores a 403 on a path the plugin does not guard', async () => {
    mocks.handler.mockImplementationOnce(verificationFailure(403, 'FORBIDDEN'))
    await POST(request('oauth2/token'))
    expect(mocks.audit).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'bot.verification.fail' }),
    )
  })
})

describe('Calendar API gates ahead of Better Auth', () => {
  it('spends no budget on a path the route does not expose', async () => {
    expect((await POST(request('nope/not-a-route'))).status).toBe(404)
    expect(mocks.limiter).not.toHaveBeenCalled()
    expect(mocks.handler).not.toHaveBeenCalled()
  })

  it('spends no budget once a budget is spent', async () => {
    mocks.limiter.mockResolvedValue({ allowed: false, retryAfter: 10 })
    expect((await POST(request('sign-in/email'))).status).toBe(429)
    expect(mocks.handler).not.toHaveBeenCalled()
  })

  it('checks the shared budget after the per-address one', async () => {
    // device/code declares a globalLimit alongside its per-address one; a
    // request inside both budgets has to have been counted against both, and
    // the per-address one has to be spent first or an address could exhaust the
    // shared budget by being the only caller.
    await POST(request('device/code'))
    expect(mocks.limiter.mock.calls.map(([options]) => options.name)).toEqual([
      'auth:device/code',
      'auth:device/code:global',
    ])
  })

  it('stops at the per-address budget without touching the shared one', async () => {
    mocks.limiter.mockResolvedValueOnce({ allowed: false, retryAfter: 10 })
    expect((await POST(request('device/code'))).status).toBe(429)
    expect(mocks.limiter).toHaveBeenCalledTimes(1)
  })

  it('forwards the original body to Better Auth', async () => {
    const body = { email: 'ada@example.com', password: 'example password' }
    const result = await POST(request('sign-in/email', body))
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual(body)
  })
})
