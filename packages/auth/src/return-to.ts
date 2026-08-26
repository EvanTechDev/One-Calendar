/**
 * Where the portal may send a user after a flow completes.
 *
 * An app links here for account settings and expects the user back, so that link
 * carries a return URL — untrusted input that decides where a browser holding a
 * live session cookie goes next. An unchecked value is an open redirect.
 *
 * The allowlist is the set of origins belonging to **registered clients**. Not an
 * environment variable: becoming a valid return target should require being a
 * client, so there is one place to add an app rather than two that can disagree.
 *
 * Fails closed. Every rejection resolves to the fallback silently, because a
 * refused redirect is not something the user can act on — and an error page
 * naming the rejected URL would happily render an attacker's text.
 */

/** Where a user lands with no return request. */
export const PORTAL_DEFAULT_PATH = '/'

/** The query parameter every app agrees on. */
export const RETURN_TO_PARAM = 'redirect'

/**
 * Origins extracted from registered redirect URIs.
 *
 * A client registers full URIs (`https://cal.example.com/api/auth/callback/x`);
 * a return target only needs to be on that client's origin, so the path is
 * dropped. That is deliberately looser than OAuth's exact redirect-URI match:
 * this is a post-flow bounce inside a known app, not the delivery of an
 * authorization code, and requiring the exact callback path would send users to
 * a callback handler rather than to a page.
 */
export function clientOriginsFromRedirectUris(
  redirectUris: readonly string[],
): string[] {
  const origins = new Set<string>()
  for (const uri of redirectUris) {
    try {
      origins.add(new URL(uri).origin)
    } catch {
      // A malformed registration contributes nothing rather than throwing: one
      // bad row must not break every return URL.
    }
  }
  return [...origins]
}

export function resolvePortalReturnTo(
  requested: string | null | undefined,
  clientOrigins: readonly string[],
  fallback: string = PORTAL_DEFAULT_PATH,
): string {
  if (!requested) return fallback

  // A relative path is same-origin by construction — but only a genuinely
  // relative one. `//evil.test` and `/\evil.test` look relative and are treated
  // as absolute by browsers, which is the classic bypass.
  if (requested.startsWith('/')) {
    if (requested.startsWith('//') || requested.startsWith('/\\')) {
      return fallback
    }
    return requested
  }

  let parsed: URL
  try {
    parsed = new URL(requested)
  } catch {
    return fallback
  }

  // `javascript:` and `data:` parse as valid URLs. Navigating to one executes
  // attacker code in the portal's own origin, so the scheme is checked before
  // anything else about the URL is trusted.
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return fallback
  }

  // Embedded credentials move the real host after the `@`:
  // `https://cal.example.com@evil.test/` has origin `evil.test` while reading
  // like the allowed host. `URL.origin` already resolves this correctly, so the
  // comparison below is safe — but the credentials are refused outright rather
  // than relied upon to be parsed the same way by every consumer downstream.
  if (parsed.username || parsed.password) return fallback

  // Exact origin comparison: scheme, host, and port together. Suffix matching
  // would accept `cal.example.com.evil.test`, and ignoring the scheme would
  // permit an http downgrade that puts the session on the wire in clear text.
  if (!clientOrigins.includes(parsed.origin)) return fallback

  return parsed.toString()
}
