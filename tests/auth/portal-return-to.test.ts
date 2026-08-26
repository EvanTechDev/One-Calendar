import { describe, it, expect } from 'vitest'
import { resolvePortalReturnTo } from '../../packages/auth/src/return-to'

/**
 * Where the portal sends a user after they finish something.
 *
 * An app links here for account settings and expects the user back, so the link
 * carries a return URL — which makes this an open-redirect surface. An
 * attacker-supplied return URL would bounce a freshly-authenticated user, with a
 * live session cookie, to any origin they chose.
 *
 * The calendar solves the same problem for one sibling app
 * (`lib/auth/return-to.ts`). The portal's version differs in one way that
 * matters: the allowlist is the set of origins from **registered clients**
 * rather than an environment variable, so adding a client is the only way to
 * become a valid return target.
 */
const CLIENTS = ['https://cal.example.com', 'https://meet.example.com']

describe('resolvePortalReturnTo', () => {
  it('returns the portal default when nothing is requested', () => {
    expect(resolvePortalReturnTo(null, CLIENTS)).toBe('/')
    expect(resolvePortalReturnTo(undefined, CLIENTS)).toBe('/')
    expect(resolvePortalReturnTo('', CLIENTS)).toBe('/')
  })

  it('allows a same-origin relative path', () => {
    expect(resolvePortalReturnTo('/account', CLIENTS)).toBe('/account')
    expect(resolvePortalReturnTo('/account/sessions', CLIENTS)).toBe(
      '/account/sessions',
    )
  })

  it('allows an absolute URL on a registered client origin', () => {
    expect(resolvePortalReturnTo('https://cal.example.com/app', CLIENTS)).toBe(
      'https://cal.example.com/app',
    )
  })

  it('refuses an origin no client registered', () => {
    // The property that makes this safe: being a return target requires being a
    // registered client, not merely being named in a query string.
    expect(resolvePortalReturnTo('https://evil.example.com/', CLIENTS)).toBe(
      '/',
    )
  })

  it('refuses a protocol-relative URL, which browsers treat as absolute', () => {
    // `//evil.com` looks relative and is not. The classic bypass.
    expect(resolvePortalReturnTo('//evil.example.com', CLIENTS)).toBe('/')
    expect(resolvePortalReturnTo('/\\evil.example.com', CLIENTS)).toBe('/')
  })

  it('refuses a non-http scheme', () => {
    // `javascript:` and `data:` parse as valid URLs and must never be navigated
    // to — doing so executes attacker code in the portal's own origin.
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      'vbscript:msgbox(1)',
    ]) {
      expect(resolvePortalReturnTo(url, CLIENTS), url).toBe('/')
    }
  })

  it('refuses a lookalike host', () => {
    // Suffix or prefix matching would accept all of these. Origin comparison is
    // exact.
    for (const url of [
      'https://cal.example.com.evil.test/',
      'https://evil-cal.example.com/',
      'https://cal.example.company/',
      'https://notcal.example.com/',
    ]) {
      expect(resolvePortalReturnTo(url, CLIENTS), url).toBe('/')
    }
  })

  it('refuses a registered host on the wrong scheme or port', () => {
    // An origin is scheme + host + port. Downgrading to http would send the
    // session across the network in clear text.
    expect(resolvePortalReturnTo('http://cal.example.com/', CLIENTS)).toBe('/')
    expect(
      resolvePortalReturnTo('https://cal.example.com:8443/', CLIENTS),
    ).toBe('/')
  })

  it('ignores embedded credentials rather than following them', () => {
    // `https://cal.example.com@evil.test/` has origin evil.test; a reader
    // skimming it sees the allowed host.
    expect(
      resolvePortalReturnTo('https://cal.example.com@evil.test/', CLIENTS),
    ).toBe('/')
  })

  it('refuses everything when no client is registered', () => {
    // A misconfigured deployment must fail closed. Falling back to "allow any"
    // would turn a missing config into an open redirect.
    expect(resolvePortalReturnTo('https://cal.example.com/app', [])).toBe('/')
  })

  it('preserves a query string and fragment on an allowed target', () => {
    // The app may encode where it was. Dropping it would send the user to a
    // useful-looking but wrong place.
    expect(
      resolvePortalReturnTo(
        'https://cal.example.com/app?view=week#today',
        CLIENTS,
      ),
    ).toBe('https://cal.example.com/app?view=week#today')
  })

  it('accepts an explicit fallback for a caller with a better default', () => {
    expect(resolvePortalReturnTo(null, CLIENTS, '/account')).toBe('/account')
    // And an unsafe request still lands on that fallback, not on the request.
    expect(
      resolvePortalReturnTo('https://evil.example.com', CLIENTS, '/account'),
    ).toBe('/account')
  })
})
