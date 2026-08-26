import { describe, it, expect } from 'vitest'
import {
  isAdminOnlyPath,
  portalPathIsExposed,
} from '../../packages/auth/src/route-policy'

/**
 * Which portal paths may be reached over HTTP.
 *
 * The OAuth provider registers a family of `/admin/oauth2/*` endpoints that can
 * create clients, assign machine-to-machine scope ceilings, and set
 * `skip_consent`. Exposing them would mean anyone who can reach the portal can
 * register a client that skips consent — an account-takeover primitive, not a
 * misconfiguration.
 *
 * The paths asserted here were read off the plugin itself rather than guessed;
 * an allowlist built from guessed paths either blocks a real endpoint or leaves
 * an unintended one open.
 */
describe('portal route policy', () => {
  it('exposes the endpoints a client needs for the code flow', () => {
    for (const path of [
      '/oauth2/authorize',
      '/oauth2/token',
      '/oauth2/userinfo',
      '/oauth2/introspect',
      '/oauth2/revoke',
    ]) {
      expect(portalPathIsExposed(path), path).toBe(true)
    }
  })

  it('exposes discovery, which clients fetch unauthenticated', () => {
    expect(portalPathIsExposed('/.well-known/oauth-authorization-server')).toBe(
      true,
    )
    expect(portalPathIsExposed('/.well-known/openid-configuration')).toBe(true)
    expect(portalPathIsExposed('/jwks')).toBe(true)
  })

  it('exposes the sign-in surface the portal owns', () => {
    for (const path of [
      '/sign-in/email',
      '/sign-up/email',
      '/sign-out',
      '/get-session',
      '/forget-password',
      '/reset-password',
      '/email-otp/send-verification-otp',
      '/email-otp/verify-email',
      '/two-factor/verify-totp',
    ]) {
      expect(portalPathIsExposed(path), path).toBe(true)
    }
  })

  it('blocks every admin endpoint', () => {
    // These can mint a client with skip_consent, which would let an attacker
    // obtain tokens for any user without a consent prompt.
    for (const path of [
      '/admin/oauth2/create-client',
      '/admin/oauth2/update-client',
      '/admin/oauth2/resources',
      '/admin/oauth2/resources/https%3A%2F%2Fapi.example.com',
      '/admin/oauth2/resources/api/clients/some-client',
    ]) {
      expect(portalPathIsExposed(path), path).toBe(false)
      expect(isAdminOnlyPath(path), path).toBe(true)
    }
  })

  it('blocks dynamic client registration', () => {
    // Registration is disabled in the portal config too; this is the second
    // layer, because a config flag flipped by accident should not become a
    // reachable endpoint.
    expect(portalPathIsExposed('/oauth2/register')).toBe(false)
  })

  it('blocks a path that merely starts like an allowed one', () => {
    // Prefix matching is the classic hole: `/oauth2/tokenizer` must not pass
    // because `/oauth2/token` is allowed.
    expect(portalPathIsExposed('/oauth2/tokenizer')).toBe(false)
    expect(portalPathIsExposed('/get-session-secrets')).toBe(false)
    expect(portalPathIsExposed('/sign-outrageous')).toBe(false)
  })

  it('blocks traversal-shaped attempts to reach an admin path', () => {
    expect(portalPathIsExposed('/oauth2/../admin/oauth2/create-client')).toBe(
      false,
    )
    expect(portalPathIsExposed('//admin/oauth2/create-client')).toBe(false)
  })

  it('is case-sensitive, matching how the router dispatches', () => {
    // Accepting `/OAuth2/Token` while the router only serves `/oauth2/token`
    // would mean the allowlist and the router disagree about what a path is.
    expect(portalPathIsExposed('/OAuth2/Token')).toBe(false)
    expect(portalPathIsExposed('/Admin/OAuth2/create-client')).toBe(false)
  })

  it('blocks an unknown path rather than defaulting open', () => {
    expect(portalPathIsExposed('/oauth2/some-future-endpoint')).toBe(false)
    expect(portalPathIsExposed('/')).toBe(false)
    expect(portalPathIsExposed('')).toBe(false)
  })
})
