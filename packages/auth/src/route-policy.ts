/**
 * Which portal paths may be reached over HTTP.
 *
 * The OAuth provider registers a family of `/admin/oauth2/*` endpoints that can
 * create a client, set `skip_consent`, and assign a machine-to-machine scope
 * ceiling. Reaching those is not a misconfiguration — it is an
 * account-takeover primitive, because a client with `skip_consent` obtains
 * tokens for any user without a prompt. They are called server-side only, from
 * a seeding script, and must never be routable.
 *
 * An allowlist rather than a denylist: an endpoint added by a future plugin
 * upgrade should arrive unreachable and require a decision, not arrive open
 * because nobody thought to deny it.
 *
 * The paths were read off the plugin's own endpoint table, not guessed. A
 * guessed allowlist either blocks a real endpoint or leaves an unintended one
 * open.
 */

/** Exact paths, relative to the auth handler's base path. */
const EXPOSED_PATHS = new Set([
  // Discovery. Fetched unauthenticated by every client, by design.
  '/.well-known/oauth-authorization-server',
  '/.well-known/openid-configuration',
  '/jwks',

  // The authorization-code flow.
  '/oauth2/authorize',
  '/oauth2/token',
  '/oauth2/userinfo',
  '/oauth2/introspect',
  '/oauth2/revoke',
  '/oauth2/consent',
  '/oauth2/continue',
  '/oauth2/end-session',
  '/oauth2/end-session/confirm',

  // What a signed-in user needs to inspect and revoke their own grants. These
  // are user-scoped by the plugin: they read the caller's session rather than
  // taking a user id.
  '/oauth2/public-client',
  '/oauth2/get-consents',
  '/oauth2/get-consent',
  '/oauth2/update-consent',
  '/oauth2/delete-consent',

  // Sign-in, sign-up, verification, recovery — the portal owns all of it.
  '/sign-in/email',
  '/sign-up/email',
  '/sign-out',
  '/get-session',
  '/forget-password',
  '/reset-password',
  '/verify-email',
  '/send-verification-email',
  '/change-password',
  '/change-email',
  '/update-user',
  '/delete-user',
  '/list-sessions',
  '/revoke-session',
  '/revoke-sessions',
  '/revoke-other-sessions',

  // Email OTP.
  '/email-otp/send-verification-otp',
  '/email-otp/verify-email',
  '/email-otp/check-verification-otp',
  '/email-otp/request-password-reset',
  '/email-otp/reset-password',
  '/email-otp/request-email-change',
  '/email-otp/change-email',

  // Two-factor.
  '/two-factor/enable',
  '/two-factor/disable',
  '/two-factor/get-totp-uri',
  '/two-factor/verify-totp',
  '/two-factor/send-otp',
  '/two-factor/verify-otp',
  '/two-factor/verify-backup-code',
  '/two-factor/generate-backup-codes',
])

/**
 * Paths that exist but are server-side only.
 *
 * Named separately from "not exposed" so a caller can tell "deliberately
 * withheld" from "unknown" — useful for a diagnostic endpoint, and the reason a
 * mistake here is visible rather than silent.
 */
const ADMIN_PREFIX = '/admin/'

export function isAdminOnlyPath(path: string): boolean {
  return path.startsWith(ADMIN_PREFIX)
}

/**
 * Whether a path may be served.
 *
 * Exact match against the allowlist, deliberately:
 *
 * - No prefix matching, so `/oauth2/tokenizer` cannot ride on `/oauth2/token`.
 * - No case folding, because the router dispatches case-sensitively; accepting
 *   `/OAuth2/Token` would mean the allowlist and the router disagree about what
 *   a path is.
 * - No normalisation of `..` or `//`. A traversal-shaped path simply is not in
 *   the set, so it is refused without this function having to reason about what
 *   it might resolve to.
 */
export function portalPathIsExposed(path: string): boolean {
  if (!path.startsWith('/')) return false
  if (isAdminOnlyPath(path)) return false
  return EXPOSED_PATHS.has(path)
}

/** The allowlist, for a diagnostics surface. Copied so a caller cannot edit it. */
export function exposedPortalPaths(): string[] {
  return [...EXPOSED_PATHS].sort()
}
