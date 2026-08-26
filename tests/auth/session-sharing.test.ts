// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { crossAppAuthConfig } from '@zntr/auth'

/**
 * Session sharing between the two apps.
 *
 * Signing in on either app must sign you in on the other. That is the whole
 * point of ADR 0022, and it works by cookie: both apps sit under one registered
 * domain, set `crossSubDomainCookies` from the same `AUTH_COOKIE_DOMAIN`, and sign
 * the cookie with a byte-identical `BETTER_AUTH_SECRET`.
 *
 * The failure mode is silent — "signed in on one app, anonymous on the other",
 * with no error anywhere — so the properties that make it work are pinned here
 * rather than left to a deployment to discover.
 */
const ROOT = resolve(__dirname, '../..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8')

const CALENDAR_AUTH = 'apps/calendar/lib/auth/index.ts'
const MEET_AUTH = 'apps/meet/lib/auth/index.ts'

describe('the cookie both apps read', () => {
  it('is scoped to the shared parent domain when configured', () => {
    const { advanced } = crossAppAuthConfig({
      cookieDomain: '.xyehr.cn',
      baseURL: 'https://precal.xyehr.cn',
      siblingOrigin: 'https://meettest.xyehr.cn',
    })
    expect(advanced?.crossSubDomainCookies).toEqual({
      enabled: true,
      domain: '.xyehr.cn',
    })
  })

  it('stays host-only when no domain is configured', () => {
    // Correct for local development on two ports: localhost:3000 and
    // localhost:3001 already share a cookie jar, and emitting a Domain for
    // "localhost" would be rejected.
    const { advanced } = crossAppAuthConfig({
      baseURL: 'http://localhost:3000',
      siblingOrigin: 'http://localhost:3001',
    })
    expect(advanced).toBeUndefined()
  })

  it('trusts the sibling origin either way', () => {
    // The sibling is where users are sent and from where they return, so it has
    // to pass the CSRF origin check whether or not cookies are shared.
    const shared = crossAppAuthConfig({
      cookieDomain: '.xyehr.cn',
      baseURL: 'https://precal.xyehr.cn',
      siblingOrigin: 'https://meettest.xyehr.cn',
    })
    const unshared = crossAppAuthConfig({
      baseURL: 'https://precal.xyehr.cn',
      siblingOrigin: 'https://meettest.xyehr.cn',
    })
    for (const config of [shared, unshared]) {
      expect(config.trustedOrigins).toContain('https://meettest.xyehr.cn')
    }
  })
})

describe('both apps configure it the same way', () => {
  const calendar = read(CALENDAR_AUTH)
  const meet = read(MEET_AUTH)

  it('both call crossAppAuthConfig', () => {
    // Not a style check. An app that builds its `advanced` block by hand will
    // eventually differ by one field, and the symptom is a user who is signed in
    // on one app and anonymous on the other with nothing logged anywhere.
    for (const source of [calendar, meet]) {
      expect(source).toContain('crossAppAuthConfig(')
      expect(source).toContain('process.env.AUTH_COOKIE_DOMAIN')
    }
  })

  it('both hash passwords with bcrypt at the same cost', () => {
    // The two apps verify each other's hashes: a row written by one is read by the
    // other. A different algorithm or cost here locks every existing user out of
    // one app only.
    for (const source of [calendar, meet]) {
      expect(source).toContain('bcrypt.hash(password, 10)')
      expect(source).toContain('bcrypt.compare(password, hash)')
    }
  })

  it('neither app names the cookie itself', () => {
    // A custom `cookiePrefix` or `cookies.session_token.name` in one app makes the
    // other unable to find the cookie at all.
    for (const source of [calendar, meet]) {
      expect(source).not.toContain('cookiePrefix')
      expect(source).not.toContain('session_token')
    }
  })

  it('both send real auth email', () => {
    // Meet's callbacks used to be inert stubs, on the assumption that only the
    // calendar ever sent mail. With a sign-up form in both, that assumption makes
    // registration succeed while the verification mail goes nowhere.
    for (const source of [calendar, meet]) {
      expect(source).toContain('authEmailCallbacks(')
      expect(source).toContain('resendSender()')
    }
    // The stub is named in a comment explaining why it is gone, so the check is
    // for a real declaration rather than the string anywhere in the file.
    expect(meet).not.toMatch(/^\s*sendResetPassword: async \(\) => \{\},?$/m)
  })

  it('both load the plugins the shared components call', () => {
    // Sign-up verifies the address with an email OTP and the account panel offers
    // 2FA. An app missing either renders a reduced version of a component whose
    // whole purpose is to be identical in both.
    for (const source of [calendar, meet]) {
      expect(source).toContain('emailOTP')
      expect(source).toContain('twoFactor')
    }
  })

  it('neither app mounts sentinel without a key', () => {
    // Sentinel with no BETTER_AUTH_API_KEY rejects every sign-in with 401
    // "Missing API key" — one absent optional variable becoming a total outage.
    // This deployment has never set it.
    expect(meet).not.toContain('sentinel')
  })
})

describe('both apps read the same database', () => {
  it('both build their client from authSchema', () => {
    // A shared cookie proves nothing if the two apps look up the session token in
    // different tables.
    expect(read('apps/calendar/lib/drizzle/client.ts')).toMatch(
      /authSchema|schema/,
    )
    expect(read('apps/meet/lib/drizzle.ts')).toContain('authSchema')
  })

  it('both take the connection from the same variables', () => {
    for (const source of [
      read('apps/calendar/lib/drizzle/client.ts'),
      read('apps/meet/lib/drizzle.ts'),
    ]) {
      expect(source).toContain('POSTGRES_URL')
      expect(source).toContain('DATABASE_URL')
    }
  })
})
