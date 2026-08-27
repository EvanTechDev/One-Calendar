/**
 * Which Better Auth routes an app exposes.
 *
 * Meet used to allow exactly two — `get-session` and `sign-out` — on the grounds
 * that it had no sign-in surface and the calendar's route was the only one
 * carrying CAPTCHA and audit logging. Mounting the shared forms means widening
 * that, and the widening is only safe because the CAPTCHA check moved into this
 * package as well (ADR 0022).
 *
 * It stays an allowlist rather than becoming a pass-through. Better Auth mounts
 * routes for every plugin it loads, so a pass-through means an app silently
 * acquires a public endpoint whenever a dependency grows one — `admin/set-role`
 * being the example that matters.
 */

const EXPOSED_GET = new Set(['get-session', 'jwks'])

const EXPOSED_POST = new Set([
  // Session lifecycle.
  'sign-in/email',
  'sign-up/email',
  'sign-out',

  // Recovery.
  'forget-password',
  'reset-password',

  // Email OTP: sign-up verifies the address with one, and the account panel's
  // change-email and change-password flows use one too.
  'email-otp/send-verification-otp',
  'email-otp/verify-email',
  'email-otp/request-email-change',
  'email-otp/change-email',
  'email-otp/request-password-reset',
  'email-otp/reset-password',

  // Two-factor, offered by the account panel.
  'two-factor/enable',
  'two-factor/disable',
  'two-factor/verify-totp',

  // Account mutations the panel performs.
  'update-user',
  'change-password',
])

const EXPOSED_OAUTH_GET = new Set([
  '.well-known/oauth-authorization-server',
  'oauth2/authorize',
  'oauth2/public-client',
  'oauth2/userinfo',
  'device',
])

const EXPOSED_OAUTH_POST = new Set([
  'oauth2/token',
  'oauth2/register',
  'oauth2/consent',
  'oauth2/introspect',
  'oauth2/revoke',
  'oauth2/public-client-prelogin',
  'device/code',
  'device/approve',
  'device/deny',
])

/**
 * Whether `path` — the segments after `/api/auth/` — is exposed for `method`.
 *
 * The comparison is on the exact remainder and is case-sensitive. A prefix test
 * would let a traversal-shaped segment smuggle in another route, and accepting
 * case variants only widens the surface for nothing: Better Auth's own routes are
 * lowercase.
 *
 * The method is part of the decision. `sign-out` over GET would let any link log
 * a user out, including one in an email or a browser prefetch.
 */
export function authRouteIsExposed(method: string, path: string): boolean {
  const verb = method.toUpperCase()
  if (verb === 'GET') return EXPOSED_GET.has(path)
  if (verb === 'POST') return EXPOSED_POST.has(path)
  return false
}

/** OAuth Provider routes exposed only by the Calendar auth host. */
export function oauthRouteIsExposed(method: string, path: string): boolean {
  const verb = method.toUpperCase()
  if (verb === 'GET') return EXPOSED_OAUTH_GET.has(path)
  if (verb === 'POST') return EXPOSED_OAUTH_POST.has(path)
  return false
}

/** Extracts the segments after `/api/auth/` from a request URL. */
export function authRoutePath(url: string): string {
  return new URL(url).pathname
    .split('/')
    .filter((segment) => segment.length > 0)
    .slice(2)
    .join('/')
}
