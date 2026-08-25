/**
 * Where to send a user after sign-in when they arrived from a sibling app.
 *
 * Zentra Meet has no sign-in surface of its own — it links here and expects the
 * user back. That link carries a return URL, which makes this an open-redirect
 * surface: an attacker-supplied `?redirect=` would otherwise bounce a
 * freshly-authenticated user to any origin they liked.
 *
 * So the allowlist is the whole point, and it is deliberately tiny: an
 * app-relative path, or an absolute URL on the meet origin this deployment
 * actually knows about. Anything else resolves to the default, silently —
 * a rejected redirect is not an error the user can act on.
 */

/** Where signed-in users land with no return request. */
export const DEFAULT_SIGNED_IN_PATH = '/app'

/** The query parameter both apps agree on. */
export const RETURN_TO_PARAM = 'redirect'

function allowedOrigins(): string[] {
  return [process.env.NEXT_PUBLIC_MEET_ORIGIN]
    .filter((origin): origin is string => Boolean(origin))
    .map((origin) => {
      try {
        return new URL(origin).origin
      } catch {
        return ''
      }
    })
    .filter(Boolean)
}

/**
 * Returns a safe destination for `requested`, or the default.
 *
 * `requested` is untrusted input straight off the query string.
 */
export function resolveReturnTo(
  requested: string | null | undefined,
  fallback: string = DEFAULT_SIGNED_IN_PATH,
): string {
  if (!requested) return fallback

  // A relative path is same-origin by construction. Reject protocol-relative
  // `//evil.com` and backslash variants, which browsers treat as absolute.
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
  // Only the sibling app, and only over http(s) — `javascript:` and friends
  // parse fine and must never be navigated to.
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return fallback
  }
  if (!allowedOrigins().includes(parsed.origin)) return fallback
  return parsed.toString()
}
