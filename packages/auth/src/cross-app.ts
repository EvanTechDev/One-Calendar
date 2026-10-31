import type { AdvancedOptions } from './types'

/**
 * Session sharing between the sibling apps (calendar + meet).
 *
 * Both apps read the same user database, but a shared database is not a shared
 * session: the session lives in a cookie, and Better Auth emits no cookie
 * `Domain` attribute unless cross-subdomain cookies are explicitly enabled.
 * Without that, a cookie set on `cal.example.com` is simply never sent to
 * `meet.example.com`, so every meet visitor is anonymous — the dashboard is
 * unreachable and an organiser opening their own Event Meeting is not
 * recognised as its Organiser.
 *
 * Two hard requirements this cannot paper over:
 *
 * 1. **Both apps must sit under one registered domain.** A cookie's `Domain`
 *    may only be a parent of the setting host, so `cal.a.com` and
 *    `meet.b.com` can never share one. There is no configuration that fixes
 *    that; it needs a different mechanism (token hand-off) instead.
 * 2. **`BETTER_AUTH_SECRET` must be byte-identical in both apps.** The cookie
 *    is signed with it, so a mismatch presents as "signed in on one app,
 *    anonymous on the other" with no error anywhere.
 *
 * Opt-in: with `AUTH_COOKIE_DOMAIN` unset, nothing changes and each app keeps
 * host-only cookies — correct for local development on two ports, where
 * `localhost:3000` and `localhost:3001` already share a cookie jar.
 */
export function crossAppAuthConfig(options: {
  /** `AUTH_COOKIE_DOMAIN`, e.g. `.zntr.app`. Undefined disables sharing. */
  cookieDomain?: string
  /** This app's own origin. */
  baseURL?: string
  /** The sibling app's origin, which must be trusted for CSRF checks. */
  siblingOrigin?: string
}): { advanced?: AdvancedOptions; trustedOrigins: string[] } {
  const { cookieDomain, baseURL, siblingOrigin } = options

  // The sibling is trusted whether or not cookies are shared: it is the origin
  // users are sent to and returned from either way.
  const trustedOrigins = [baseURL, siblingOrigin]
    .filter((origin): origin is string => Boolean(origin))
    .map((origin) => origin.replace(/\/$/, ''))

  if (!cookieDomain) return { trustedOrigins }

  return {
    advanced: {
      crossSubDomainCookies: { enabled: true, domain: cookieDomain },
    },
    trustedOrigins,
  }
}
