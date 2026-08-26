import { describe, it, expect } from 'vitest'
import { portalAccountUrl } from '../../packages/auth/src/handoff'

/**
 * Where an app sends a user to manage their account.
 *
 * ADR 0021 decision 4: an app never renders a form that writes user data. It
 * links to the portal and the portal returns the user. So this link is the whole
 * mechanism, and it carries a return URL — which makes it the same
 * open-redirect surface as the sign-in handoff, and it gets the same guard.
 */
const PORTAL = 'https://auth.example.com'
const SELF = 'https://cal.example.com'

describe('portalAccountUrl', () => {
  it('points at the portal root, which is the dashboard', () => {
    const url = new URL(portalAccountUrl({ portal: PORTAL, selfOrigin: SELF }))
    expect(url.origin).toBe(PORTAL)
    expect(url.pathname).toBe('/')
  })

  it('asks to be returned to the app the user came from', () => {
    const url = new URL(
      portalAccountUrl({ portal: PORTAL, selfOrigin: SELF, returnTo: '/app' }),
    )
    expect(url.searchParams.get('redirect')).toBe(`${SELF}/app`)
  })

  it('can open a specific section', () => {
    // "Change my password" should land on Security, not on Overview with the
    // user hunting for it.
    const url = new URL(
      portalAccountUrl({
        portal: PORTAL,
        selfOrigin: SELF,
        section: 'security',
      }),
    )
    expect(url.searchParams.get('section')).toBe('security')
  })

  it('refuses an unknown section rather than passing it through', () => {
    // A reflected section name would be attacker-controlled input rendered by
    // the portal's nav.
    const url = new URL(
      portalAccountUrl({
        portal: PORTAL,
        selfOrigin: SELF,
        section: 'evil' as never,
      }),
    )
    expect(url.searchParams.get('section')).toBeNull()
  })

  it('returns an empty string when no portal is configured', () => {
    // A deployment missing NEXT_PUBLIC_AUTH_ORIGIN must get a dead link rather
    // than a thrown TypeError. Found by a meet test that omitted the prop, but
    // the real case is a misconfigured deploy taking the settings dialog down.
    expect(portalAccountUrl({ portal: '' })).toBe('')
    expect(portalAccountUrl({ portal: undefined as never })).toBe('')
  })

  it('applies the same return-URL guard as sign-in', () => {
    // The guard cannot be weaker here just because the destination differs:
    // both produce a portal URL the user is about to trust.
    for (const bad of [
      'https://evil.example.com/',
      '//evil.example.com',
      'javascript:alert(1)',
    ]) {
      const url = new URL(
        portalAccountUrl({ portal: PORTAL, selfOrigin: SELF, returnTo: bad }),
      )
      expect(url.searchParams.get('redirect'), bad).toBe(`${SELF}/app`)
    }
  })
})
