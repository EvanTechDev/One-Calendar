import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The portal's configuration, asserted as security properties.
 *
 * A misconfigured authorization server fails silently — it issues tokens
 * happily while skipping a check — so these assert the config actually handed to
 * `betterAuth()`. Prior art: tests/auth/verification-ownership.test.ts, which
 * caught the duplicate-verification-email bug at this same seam.
 *
 * The alias trap applies: without an entry in packages/auth/vitest.config.ts,
 * `vi.mock` silently no-ops and the test runs against the real library. One
 * assertion in this repo has already passed vacuously that way.
 */
const captured: { config?: Record<string, any> } = {}

vi.mock('better-auth', () => ({
  betterAuth: (config: Record<string, any>) => {
    captured.config = config
    return { api: {} }
  },
}))

vi.mock('better-auth/adapters/drizzle', () => ({
  drizzleAdapter: () => ({}),
}))

vi.mock('better-auth/plugins', () => ({
  twoFactor: (options?: unknown) => ({ id: 'two-factor', options }),
  emailOTP: (options?: unknown) => ({ id: 'email-otp', options }),
  jwt: (options?: unknown) => ({ id: 'jwt', options }),
}))

vi.mock('@better-auth/oauth-provider', () => ({
  oauthProvider: (options?: unknown) => ({ id: 'oauth-provider', options }),
}))

vi.mock('@better-auth/sentinel', () => ({
  sentinel: (options?: unknown) => ({ id: 'sentinel', options }),
}))

const { createAuthPortal } = await import('../../packages/auth/src/portal')

function build(overrides: Record<string, unknown> = {}) {
  return createAuthPortal({
    db: {} as never,
    secret: 'a-portal-secret-long-enough-for-hs256',
    baseURL: 'https://auth.example.com',
    trustedOrigins: ['https://cal.example.com', 'https://meet.example.com'],
    emailCallbacks: {
      sendResetPassword: vi.fn(),
      sendVerificationEmail: vi.fn(),
      sendVerificationOTP: vi.fn(),
    },
    password: { hash: vi.fn(), verify: vi.fn() },
    ...overrides,
  } as never)
}

function plugin(id: string): { id: string; options: any } | undefined {
  return (captured.config?.plugins ?? []).find(
    (entry: { id?: string }) => entry?.id === id,
  )
}

beforeEach(() => {
  captured.config = undefined
})

describe('the auth portal configuration', () => {
  it('mounts the OAuth provider', () => {
    build()
    expect(plugin('oauth-provider')).toBeDefined()
  })

  it('mounts the jwt plugin the provider requires', () => {
    // Back-channel logout and JWT access tokens both depend on it, and
    // registering a backchannel_logout_uri without it is rejected outright.
    build()
    expect(plugin('jwt')).toBeDefined()
  })

  it('keeps the security plugins the calendar already had', () => {
    // The portal inherits responsibility for credential stuffing, bot blocking
    // and 2FA. Losing one while moving sign-in would be a silent downgrade.
    build()
    expect(plugin('two-factor')).toBeDefined()
    expect(plugin('sentinel')).toBeDefined()
    expect(plugin('email-otp')).toBeDefined()
  })

  it('sends users to the portal-owned sign-in page', () => {
    build()
    expect(plugin('oauth-provider')!.options.loginPage).toBe('/sign-in')
  })

  it('refuses dynamic client registration', () => {
    // Every client is first-party and registered deliberately. Open
    // registration is a surface with no user until a third-party client exists.
    build()
    const options = plugin('oauth-provider')!.options
    expect(options.allowDynamicClientRegistration).toBe(false)
    expect(options.allowUnauthenticatedClientRegistration).toBe(false)
  })

  it('bounds the access-token lifetime', () => {
    // A JWT access token cannot be revoked individually -- it is self-contained
    // and never stored -- so a short expiry is the only control. An unbounded
    // lifetime would make revocation impossible rather than merely delayed.
    const options = (build(), plugin('oauth-provider')!.options)
    expect(options.accessTokenExpiresIn).toBeGreaterThan(0)
    expect(options.accessTokenExpiresIn).toBeLessThanOrEqual(900)
  })

  it('keeps strict refresh-token replay detection', () => {
    // A reuse interval tolerates a replayed refresh token for that long. Zero
    // means a reused token invalidates the whole family, which is the behaviour
    // we want until a client proves it needs otherwise.
    build()
    expect(plugin('oauth-provider')!.options.refreshTokenReuseInterval).toBe(0)
  })

  it('trusts exactly the client origins it was given', () => {
    build()
    expect(captured.config?.trustedOrigins).toEqual([
      'https://cal.example.com',
      'https://meet.example.com',
    ])
  })

  it('requires email verification before sign-in', () => {
    build()
    expect(captured.config?.emailAndPassword.requireEmailVerification).toBe(
      true,
    )
  })

  it('leaves verification to the OTP plugin, not a link', () => {
    // Regression guard for the two-emails bug: the plugin implements
    // overrideDefaultEmailVerification from its init, and Better Auth folds
    // plugin options in with defu, which keeps the value already present. A
    // top-level sendVerificationEmail therefore outbids the override.
    build()
    expect(
      Object.hasOwn(
        captured.config?.emailVerification ?? {},
        'sendVerificationEmail',
      ),
    ).toBe(false)
    expect(plugin('email-otp')!.options.overrideDefaultEmailVerification).toBe(
      true,
    )
  })

  it('rejects a portal built without a secret', () => {
    // The portal signs every token. A missing secret must stop startup rather
    // than fall back to something guessable.
    expect(() => build({ secret: undefined })).toThrow(/secret/i)
  })

  it('rejects a portal built without a baseURL', () => {
    // The baseURL is the OAuth issuer. Deriving it from an incoming request
    // would let a request choose its own issuer value.
    expect(() => build({ baseURL: undefined })).toThrow(/baseURL|issuer/i)
  })
})
