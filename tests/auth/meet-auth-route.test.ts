// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { authRouteIsExposed } from '@zntr/auth/route-policy'

/**
 * Which Better Auth routes an app exposes.
 *
 * Meet used to allow exactly two — `get-session` and `sign-out` — because it had
 * no sign-in surface and the calendar's route was the only one carrying CAPTCHA
 * and audit logging. Mounting the shared forms means widening this, and the
 * widening is only safe because the CAPTCHA check moved into the package too
 * (ADR 0022).
 *
 * It stays an allowlist rather than becoming a pass-through: Better Auth mounts
 * routes for every plugin, and an app should not silently acquire an endpoint
 * because a dependency added one.
 */
describe('authRouteIsExposed', () => {
  it('exposes what signing in needs', () => {
    expect(authRouteIsExposed('POST', 'sign-in/email')).toBe(true)
    expect(authRouteIsExposed('POST', 'sign-up/email')).toBe(true)
    expect(authRouteIsExposed('POST', 'sign-out')).toBe(true)
    expect(authRouteIsExposed('GET', 'get-session')).toBe(true)
  })

  it('exposes recovery', () => {
    expect(authRouteIsExposed('POST', 'forget-password')).toBe(true)
    expect(authRouteIsExposed('POST', 'reset-password')).toBe(true)
  })

  it('exposes the OTP endpoints the shared forms call', () => {
    // Sign-up verifies the address with one, and the account panel's change-email
    // and change-password flows do too.
    expect(authRouteIsExposed('POST', 'email-otp/send-verification-otp')).toBe(
      true,
    )
    expect(authRouteIsExposed('POST', 'email-otp/verify-email')).toBe(true)
    expect(authRouteIsExposed('POST', 'email-otp/request-email-change')).toBe(
      true,
    )
    expect(authRouteIsExposed('POST', 'email-otp/change-email')).toBe(true)
  })

  it('exposes the 2FA endpoints the panel offers', () => {
    expect(authRouteIsExposed('POST', 'two-factor/enable')).toBe(true)
    expect(authRouteIsExposed('POST', 'two-factor/disable')).toBe(true)
    expect(authRouteIsExposed('POST', 'two-factor/verify-totp')).toBe(true)
  })

  it('exposes the account mutations the panel performs', () => {
    expect(authRouteIsExposed('POST', 'update-user')).toBe(true)
    expect(authRouteIsExposed('POST', 'change-password')).toBe(true)
  })

  it('does not expose anything else', () => {
    // The point of an allowlist: a plugin that adds an endpoint does not thereby
    // add it to this app's public surface.
    expect(authRouteIsExposed('POST', 'admin/create-user')).toBe(false)
    expect(authRouteIsExposed('POST', 'admin/set-role')).toBe(false)
    expect(authRouteIsExposed('POST', 'api-key/create')).toBe(false)
    expect(authRouteIsExposed('GET', 'admin/list-users')).toBe(false)
  })

  it('matches the method too', () => {
    // `sign-out` over GET would make a link log the user out — including a link
    // in an email, or a prefetch.
    expect(authRouteIsExposed('GET', 'sign-out')).toBe(false)
    expect(authRouteIsExposed('POST', 'get-session')).toBe(false)
  })

  it('matches the whole remainder, never a prefix', () => {
    // A prefix test lets a traversal-shaped segment smuggle in another route.
    expect(authRouteIsExposed('POST', 'sign-in/email/../admin/set-role')).toBe(
      false,
    )
    expect(authRouteIsExposed('POST', 'sign-outx')).toBe(false)
    expect(authRouteIsExposed('POST', 'sign-out/extra')).toBe(false)
  })

  it('is case-sensitive on the path', () => {
    // Better Auth's own routes are lowercase; accepting variants only widens the
    // surface for no gain.
    expect(authRouteIsExposed('POST', 'Sign-Out')).toBe(false)
  })
})
