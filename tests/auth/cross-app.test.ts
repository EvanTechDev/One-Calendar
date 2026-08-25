/**
 * Cross-app session sharing (SEC-01).
 *
 * Both apps read one user database, but that is not one session: the session is
 * a cookie, and Better Auth emits no cookie `Domain` unless cross-subdomain
 * cookies are explicitly enabled. Without it, meet's entire signed-in surface
 * is dead — dashboard unreachable, and an organiser opening their own Event
 * Meeting is not recognised as its Organiser.
 *
 * This pins the opt-in shape: unset means "unchanged", set means a Domain is
 * emitted, and the sibling origin is trusted either way.
 */
import { describe, it, expect } from 'vitest'
import { crossAppAuthConfig } from '@zntr/auth/cross-app'

const CAL = 'https://cal.zntr.app'
const MEET = 'https://meet.zntr.app'

describe('crossAppAuthConfig', () => {
  it('emits no advanced block when no cookie domain is configured', () => {
    // Local development: two ports on localhost already share a cookie jar,
    // so host-only cookies are correct and must not be changed.
    const config = crossAppAuthConfig({ baseURL: CAL, siblingOrigin: MEET })
    expect(config.advanced).toBeUndefined()
  })

  it('enables cross-subdomain cookies on the given parent domain', () => {
    const config = crossAppAuthConfig({
      cookieDomain: '.zntr.app',
      baseURL: CAL,
      siblingOrigin: MEET,
    })
    expect(config.advanced).toEqual({
      crossSubDomainCookies: { enabled: true, domain: '.zntr.app' },
    })
  })

  it('trusts the sibling origin whether or not cookies are shared', () => {
    // The sibling is where users are sent and returned from either way, so it
    // must pass the CSRF origin check regardless.
    for (const cookieDomain of [undefined, '.zntr.app']) {
      const config = crossAppAuthConfig({
        cookieDomain,
        baseURL: CAL,
        siblingOrigin: MEET,
      })
      expect(config.trustedOrigins).toEqual([CAL, MEET])
    }
  })

  it('drops trailing slashes so one origin is not listed twice in two forms', () => {
    const config = crossAppAuthConfig({
      baseURL: `${CAL}/`,
      siblingOrigin: `${MEET}/`,
    })
    expect(config.trustedOrigins).toEqual([CAL, MEET])
  })

  it('omits origins that are not configured', () => {
    expect(crossAppAuthConfig({ baseURL: CAL }).trustedOrigins).toEqual([CAL])
    expect(crossAppAuthConfig({}).trustedOrigins).toEqual([])
  })
})
