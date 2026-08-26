import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  captchaIsGuarded,
  isTurnstileConfigured,
  verifyTurnstile,
} from '@zntr/auth/turnstile'

/**
 * The CAPTCHA gate, shared by both apps.
 *
 * The forms render a Turnstile widget, but a widget is a browser courtesy: a POST
 * straight to `/api/auth/sign-in/email` never sees it. The calendar has always
 * verified server-side; meet is gaining a sign-up surface and must do the same,
 * which is why the check lives in the package now (ADR 0022).
 *
 * It carries more weight than it sounds: Better Auth's sentinel plugin only
 * mounts when BETTER_AUTH_API_KEY is set, and it never has been, so Turnstile is
 * the whole bot defence.
 */
const ORIGINAL = process.env.TURNSTILE_SECRET_KEY

beforeEach(() => {
  delete process.env.TURNSTILE_SECRET_KEY
  vi.unstubAllGlobals()
})

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.TURNSTILE_SECRET_KEY
  else process.env.TURNSTILE_SECRET_KEY = ORIGINAL
})

describe('captchaIsGuarded', () => {
  it('guards sign-in and sign-up', () => {
    expect(captchaIsGuarded('POST', '/sign-in/email')).toBe(true)
    expect(captchaIsGuarded('POST', '/sign-up/email')).toBe(true)
  })

  it('guards password recovery, which is an email-sending surface', () => {
    // Unthrottled recovery is a way to send mail to arbitrary addresses using
    // our sender reputation.
    expect(captchaIsGuarded('POST', '/forget-password')).toBe(true)
    expect(captchaIsGuarded('POST', '/email-otp/request-password-reset')).toBe(
      true,
    )
  })

  it('does not guard reads', () => {
    // A guarded `get-session` would demand a token on every page load of every
    // client app.
    expect(captchaIsGuarded('GET', '/get-session')).toBe(false)
    expect(captchaIsGuarded('GET', '/jwks')).toBe(false)
  })

  it('does not guard the OAuth protocol endpoints', () => {
    // These are called by a server holding a client secret, not by a browser
    // that could solve a challenge. Guarding them would break the code flow.
    expect(captchaIsGuarded('POST', '/oauth2/token')).toBe(false)
    expect(captchaIsGuarded('POST', '/oauth2/introspect')).toBe(false)
    expect(captchaIsGuarded('POST', '/oauth2/authorize')).toBe(false)
  })

  it('does not guard sign-out', () => {
    // Making it harder to leave is not a security improvement.
    expect(captchaIsGuarded('POST', '/sign-out')).toBe(false)
  })

  it('does not guard a session-authenticated action', () => {
    // Changing a password already requires the session; a challenge adds
    // friction without adding a barrier an attacker has to cross.
    expect(captchaIsGuarded('POST', '/change-password')).toBe(false)
    expect(captchaIsGuarded('POST', '/update-user')).toBe(false)
  })
})

describe('isTurnstileConfigured', () => {
  it('is false with no secret', () => {
    expect(isTurnstileConfigured()).toBe(false)
  })

  it('is false for a blank secret', () => {
    // An empty string in a dashboard is the same as absent, and treating it as
    // present would demand tokens nothing can verify.
    process.env.TURNSTILE_SECRET_KEY = '   '
    expect(isTurnstileConfigured()).toBe(false)
  })

  it('is true with a secret', () => {
    process.env.TURNSTILE_SECRET_KEY = 'a-secret'
    expect(isTurnstileConfigured()).toBe(true)
  })
})

describe('verifyTurnstile', () => {
  it('reports success when Cloudflare accepts the token', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'a-secret'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ success: true }))),
    )
    await expect(verifyTurnstile('token', 'login')).resolves.toEqual({
      success: true,
      errorCodes: undefined,
    })
  })

  it('reports failure with the error codes Cloudflare returned', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'a-secret'
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: false,
              'error-codes': ['timeout-or-duplicate'],
            }),
          ),
      ),
    )
    const result = await verifyTurnstile('token', 'login')
    expect(result.success).toBe(false)
    expect(result.errorCodes).toEqual(['timeout-or-duplicate'])
  })

  it('throws when called with no secret, rather than passing', async () => {
    // Callers gate on isTurnstileConfigured first. Reaching here means
    // verification was attempted with nothing to verify against, which cannot be
    // answered truthfully either way — so it must not silently succeed.
    await expect(verifyTurnstile('token', 'login')).rejects.toThrow(
      /TURNSTILE_SECRET_KEY/,
    )
  })

  it('throws when Cloudflare is unreachable', async () => {
    // Distinguished from "token rejected" on purpose: the caller decides whether
    // an outage should block sign-in, and it cannot decide if both look alike.
    process.env.TURNSTILE_SECRET_KEY = 'a-secret'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    )
    await expect(verifyTurnstile('token', 'login')).rejects.toThrow(
      /siteverify/,
    )
  })

  it('sends the secret in the body, never in a URL', async () => {
    // A secret in a query string lands in logs and proxies.
    process.env.TURNSTILE_SECRET_KEY = 'a-secret'
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ success: true })),
    )
    vi.stubGlobal('fetch', fetchMock)
    await verifyTurnstile('token', 'login')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).not.toContain('a-secret')
    expect(String(init.body)).toContain('secret=a-secret')
  })
})
