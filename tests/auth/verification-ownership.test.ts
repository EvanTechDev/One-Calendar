import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * Sign-up sent two verification emails: one link, one code.
 *
 * The emailOTP plugin implements `overrideDefaultEmailVerification` from its
 * `init`, returning its own `emailVerification.sendVerificationEmail`. Better
 * Auth folds plugin options in with `defu(options, pluginOptions)`, and defu
 * keeps whatever is already present — so a top-level `sendVerificationEmail`
 * outbids the override and the link goes out alongside the code.
 *
 * The config handed to `betterAuth` is what decides this, so that is what these
 * assert. Capturing it also means the test cannot pass by mocking away the
 * behaviour under test.
 */
const captured: { config?: Record<string, any> } = {}

vi.mock('better-auth', () => ({
  betterAuth: (config: Record<string, any>) => {
    captured.config = config
    return { api: {} }
  },
}))

vi.mock('@better-auth/drizzle-adapter', () => ({
  drizzleAdapter: () => ({}),
}))

vi.mock('better-auth/plugins', () => ({
  twoFactor: (options?: unknown) => ({ id: 'two-factor', options }),
  emailOTP: (options?: unknown) => ({ id: 'email-otp', options }),
  jwt: (options?: unknown) => ({ id: 'jwt', options }),
}))

vi.mock('@better-auth/infra', () => ({
  sentinel: (options?: unknown) => ({ id: 'sentinel', options }),
}))

const { createAuth } = await import('../../packages/auth/src/server')

const sendVerificationEmail = vi.fn()
const sendVerificationOTP = vi.fn()

function build(emailOTP: unknown) {
  return createAuth({
    db: {} as never,
    secret: 'a-secret-long-enough-to-be-plausible-000',
    emailCallbacks: {
      sendVerificationEmail,
      sendResetPassword: vi.fn(),
      sendVerificationOTP,
    },
    plugins: { emailOTP },
  } as never)
}

beforeEach(() => {
  captured.config = undefined
})

describe('email verification ownership', () => {
  it('leaves the link callback out when the OTP plugin overrides it', () => {
    build({ overrideDefaultEmailVerification: true })

    // Present-but-undefined is not enough: defu treats an own key as a value to
    // keep, so the key itself has to be absent.
    expect(
      Object.hasOwn(
        captured.config?.emailVerification ?? {},
        'sendVerificationEmail',
      ),
    ).toBe(false)
  })

  it('keeps the link callback when the plugin does not override', () => {
    build({ changeEmail: { enabled: true } })

    expect(captured.config?.emailVerification.sendVerificationEmail).toBe(
      sendVerificationEmail,
    )
  })

  it('keeps the link callback when emailOTP is enabled with defaults', () => {
    // `emailOTP: true` does not opt into the override, so verification is still
    // the link's job and removing it would leave sign-up with no email at all.
    build(true)

    expect(captured.config?.emailVerification.sendVerificationEmail).toBe(
      sendVerificationEmail,
    )
  })

  it('keeps the link callback when there is no OTP plugin', () => {
    build(undefined)

    expect(captured.config?.emailVerification.sendVerificationEmail).toBe(
      sendVerificationEmail,
    )
  })

  it('still passes the OTP sender to the plugin when it owns verification', () => {
    build({ overrideDefaultEmailVerification: true })

    // The override routes verification INTO the plugin, so a missing sender
    // here would mean no verification email of either kind.
    const plugin = (captured.config?.plugins ?? []).find(
      (entry: { id?: string }) => entry?.id === 'email-otp',
    )
    expect(plugin?.options?.sendVerificationOTP).toBe(sendVerificationOTP)
  })

  it('leaves the slot the plugin fills, rather than emptying it', () => {
    build({ overrideDefaultEmailVerification: true })

    // Sign-up calls `options.emailVerification.sendVerificationEmail` — the very
    // slot the plugin's `init` replaces with its OTP sender. Removing our link
    // callback must therefore leave the KEY absent (so defu lets the plugin in),
    // not the block absent (which would give defu nothing to merge into).
    expect(captured.config?.emailVerification).toBeDefined()
    expect(typeof captured.config?.emailVerification).toBe('object')
  })

  it('keeps change-email verification regardless of the override', () => {
    // A different flow: the plugin's changeEmail OTP is requested explicitly,
    // so dropping this would break email changes rather than de-duplicate them.
    const sendChangeEmailVerification = vi.fn()
    createAuth({
      db: {} as never,
      secret: 'a-secret-long-enough-to-be-plausible-000',
      emailCallbacks: {
        sendVerificationEmail,
        sendResetPassword: vi.fn(),
        sendVerificationOTP,
        sendChangeEmailVerification,
      },
      plugins: { emailOTP: { overrideDefaultEmailVerification: true } },
    } as never)

    expect(captured.config?.emailVerification.sendChangeEmailVerification).toBe(
      sendChangeEmailVerification,
    )
  })
})
