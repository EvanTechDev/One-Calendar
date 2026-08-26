/**
 * Where to send a user after sign-in when they arrived from a sibling app.
 *
 * Each app links to the other and expects the user back, so both carry a return
 * URL — and both are therefore open-redirect surfaces: an attacker-supplied
 * `?redirect=` would otherwise bounce a freshly-authenticated user anywhere.
 *
 * The calendar had a hardened resolver and meet had none, because meet had no
 * sign-in page. Now that it does (ADR 0022), it gets this one rather than a second
 * copy that only handles the cases whoever wrote it thought of.
 *
 * The allowlist is deliberately tiny: an app-relative path, or an absolute URL on
 * a sibling origin this deployment actually knows about. Anything else resolves to
 * the default silently — a rejected redirect is not something the user can act on.
 */

/** The query parameter both apps agree on. */
export const RETURN_TO_PARAM = 'redirect'

export type ReturnToResolver = (
  requested: string | null | undefined,
  fallback?: string,
) => string

export function createReturnToResolver(options: {
  /** Where signed-in users land with no return request. */
  defaultPath: string
  /**
   * Origins the return URL may point at, besides this app itself.
   *
   * A function, not an array, and read on each call. The values come from
   * `NEXT_PUBLIC_*` env vars, which are inlined at build time and so cannot
   * change at runtime — but a module evaluated before the environment is
   * populated would capture an EMPTY allowlist and then reject every sibling URL
   * for the life of the process. That failure is silent: the redirect just goes
   * to the default, which looks like a user who asked for nothing.
   */
  siblingOrigins: (string | undefined)[] | (() => (string | undefined)[])
}): ReturnToResolver {
  const readOrigins = () =>
    (typeof options.siblingOrigins === 'function'
      ? options.siblingOrigins()
      : options.siblingOrigins
    )
      .filter((origin): origin is string => Boolean(origin))
      .map((origin) => {
        try {
          return new URL(origin).origin
        } catch {
          // A misconfigured value must narrow the allowlist, never widen it, so
          // it is dropped rather than kept as a raw string to prefix-match later.
          return ''
        }
      })
      .filter(Boolean)

  return (requested, fallback = options.defaultPath) => {
    if (!requested) return fallback

    // A relative path is same-origin by construction. Reject protocol-relative
    // `//evil.com` and the backslash variants some browsers normalise into it.
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

    // `javascript:` and `data:` parse perfectly well and must never be navigated
    // to, so the scheme is checked before the origin.
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return fallback
    }

    // Origin equality, not a prefix test: `https://sibling.example.com.evil.com`
    // starts with the allowed origin and is a different site.
    if (!readOrigins().includes(parsed.origin)) return fallback

    return parsed.toString()
  }
}
