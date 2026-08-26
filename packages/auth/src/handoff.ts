import { RETURN_TO_PARAM } from './return-to'

/**
 * How a client app hands a user to the portal.
 *
 * The mirror of `resolvePortalReturnTo`: that guards what the portal will accept,
 * this guards what a client will ask for. Both are needed. A client reflecting an
 * unvalidated `?redirect=` into the handoff would turn its own sign-in route into
 * an open-redirect launcher — the portal would refuse the target, but the user
 * has already been shown a portal URL carrying an attacker's origin, which is the
 * phishing half of the attack.
 *
 * One function for all three routes (sign-in, sign-up, recovery), because a
 * separate ad-hoc construction per route is how one of them ends up unguarded.
 */

/** Where a signed-in user lands with no specific request. */
const DEFAULT_PATH = '/app'

export interface PortalHandoffOptions {
  /** The portal's origin. */
  portal: string
  /** This app's own origin, so the portal can return the user here. */
  selfOrigin?: string
  /** Which portal page to open. */
  page?: '/sign-in' | '/sign-up' | '/reset-password'
  /**
   * Where to come back to. Untrusted — usually straight off this app's own
   * query string.
   */
  returnTo?: string | null
}

/**
 * Resolves an untrusted return request to a path within this app.
 *
 * Only in-app paths, deliberately. A client has no business asking the portal to
 * send a user to a third origin, so absolutes are refused outright rather than
 * checked against a list — there is no legitimate case to allow.
 */
function safePath(requested: string | null | undefined): string {
  if (!requested) return DEFAULT_PATH
  if (!requested.startsWith('/')) return DEFAULT_PATH
  // `//evil.test` and `/\evil.test` look relative and browsers treat them as
  // absolute.
  if (requested.startsWith('//') || requested.startsWith('/\\')) {
    return DEFAULT_PATH
  }
  return requested
}

export function portalSignInUrl(options: PortalHandoffOptions): string {
  const portal = options.portal.replace(/\/$/, '')
  const page = options.page ?? '/sign-in'
  const path = safePath(options.returnTo)

  // A relative target when this app does not know its own origin. Emitting
  // `undefined/app` would be refused by the portal and would tell the user
  // nothing about why.
  const selfOrigin = options.selfOrigin?.replace(/\/$/, '')
  const target = selfOrigin ? `${selfOrigin}${path}` : path

  const url = new URL(`${portal}${page}`)
  // `URLSearchParams` encodes, so an `&` in the target survives as part of one
  // value rather than splitting into a second parameter.
  url.searchParams.set(RETURN_TO_PARAM, target)
  return url.toString()
}
