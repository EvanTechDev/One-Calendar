import { describe, it, expect } from 'vitest'
import { portalSignInUrl } from '../../packages/auth/src/handoff'

/**
 * How a client app sends a user to the portal.
 *
 * The calendar's own /sign-in becomes a redirect here, so old bookmarks and
 * links in already-sent verification emails keep working rather than 404ing.
 *
 * The return target travels in the URL, which makes this the mirror of
 * `resolvePortalReturnTo`: that one guards what the portal accepts, this one
 * guards what a client asks for. A client that reflected an unvalidated
 * `?redirect=` straight into the handoff would turn its own sign-in route into
 * an open-redirect launcher, even though the portal would refuse the target —
 * the user still sees a portal URL carrying an attacker's origin.
 */
const PORTAL = 'https://auth.example.com'
const SELF = 'https://cal.example.com'

describe('portalSignInUrl', () => {
  it('points at the portal sign-in page', () => {
    const url = new URL(portalSignInUrl({ portal: PORTAL, selfOrigin: SELF }))
    expect(url.origin).toBe(PORTAL)
    expect(url.pathname).toBe('/sign-in')
  })

  it('asks to be returned to this app by default', () => {
    const url = new URL(portalSignInUrl({ portal: PORTAL, selfOrigin: SELF }))
    expect(url.searchParams.get('redirect')).toBe(`${SELF}/app`)
  })

  it('carries a requested in-app path', () => {
    const url = new URL(
      portalSignInUrl({
        portal: PORTAL,
        selfOrigin: SELF,
        returnTo: '/app?view=week',
      }),
    )
    expect(url.searchParams.get('redirect')).toBe(`${SELF}/app?view=week`)
  })

  it('refuses to reflect an absolute URL from the caller', () => {
    // The bypass this exists to stop: a client's /sign-in?redirect=https://evil
    // must not produce a portal URL naming evil. Falls back to this app's own
    // default rather than passing it on.
    const url = new URL(
      portalSignInUrl({
        portal: PORTAL,
        selfOrigin: SELF,
        returnTo: 'https://evil.example.com/',
      }),
    )
    expect(url.searchParams.get('redirect')).toBe(`${SELF}/app`)
  })

  it('refuses a protocol-relative path', () => {
    for (const value of ['//evil.example.com', '/\\evil.example.com']) {
      const url = new URL(
        portalSignInUrl({ portal: PORTAL, selfOrigin: SELF, returnTo: value }),
      )
      expect(url.searchParams.get('redirect'), value).toBe(`${SELF}/app`)
    }
  })

  it('refuses a non-http scheme', () => {
    const url = new URL(
      portalSignInUrl({
        portal: PORTAL,
        selfOrigin: SELF,
        returnTo: 'javascript:alert(1)',
      }),
    )
    expect(url.searchParams.get('redirect')).toBe(`${SELF}/app`)
  })

  it('encodes the return target so it survives as one parameter', () => {
    // An unencoded `&` would split the value and silently truncate where the
    // user lands.
    const url = portalSignInUrl({
      portal: PORTAL,
      selfOrigin: SELF,
      returnTo: '/app?view=week&day=3',
    })
    expect(url).toContain(encodeURIComponent(`${SELF}/app?view=week&day=3`))
    expect(new URL(url).searchParams.get('redirect')).toBe(
      `${SELF}/app?view=week&day=3`,
    )
  })

  it('tolerates a trailing slash on either origin', () => {
    const url = new URL(
      portalSignInUrl({
        portal: `${PORTAL}/`,
        selfOrigin: `${SELF}/`,
        returnTo: '/app',
      }),
    )
    expect(url.origin).toBe(PORTAL)
    expect(url.searchParams.get('redirect')).toBe(`${SELF}/app`)
  })

  it('sends a relative path when this app does not know its own origin', () => {
    // A misconfigured NEXT_PUBLIC_BASE_URL must not produce `undefined/app`,
    // which the portal would refuse and which tells the user nothing.
    const url = new URL(portalSignInUrl({ portal: PORTAL }))
    expect(url.searchParams.get('redirect')).toBe('/app')
  })

  it('reaches sign-up and reset through the same guarded path', () => {
    // Three routes redirect, and all three must resolve the return target the
    // same way — a separate ad-hoc construction for each is how one of them
    // ends up unguarded.
    const signUp = new URL(
      portalSignInUrl({
        portal: PORTAL,
        selfOrigin: SELF,
        page: '/sign-up',
        returnTo: 'https://evil.example.com',
      }),
    )
    expect(signUp.pathname).toBe('/sign-up')
    expect(signUp.searchParams.get('redirect')).toBe(`${SELF}/app`)
  })
})
