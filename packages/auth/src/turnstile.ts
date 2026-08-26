/**
 * Server-side CAPTCHA verification, shared by both apps.
 *
 * Lifted out of `apps/calendar/lib/turnstile.ts` because meet is gaining a
 * sign-up surface and needs the identical check (ADR 0022). A Turnstile widget is
 * a browser courtesy: a POST straight to `/api/auth/sign-in/email` never sees
 * one, so the client-side check is a hint and this is the control.
 *
 * It carries the whole load. Better Auth's sentinel plugin only mounts when
 * BETTER_AUTH_API_KEY is set, and this deployment has never set it -- so
 * Turnstile is the only bot defence either app has.
 */

export type TurnstileVerifyResult = {
  success: boolean
  errorCodes?: string[]
}

/**
 * Which requests must carry a solved challenge.
 *
 * Two things are deliberately NOT guarded:
 *
 * - **OAuth protocol endpoints.** `/oauth2/token` and friends are called by a
 *   server holding a client secret, not by a browser that could solve a
 *   challenge. Guarding them would break the authorization-code flow outright.
 * - **Session-authenticated actions** like `/change-password`. The session is
 *   already the barrier; a challenge adds friction without adding anything an
 *   attacker has to cross.
 *
 * Recovery endpoints ARE guarded, because unthrottled recovery is a way to send
 * mail to arbitrary addresses using our sender reputation.
 */
const GUARDED_PATHS = new Set([
  '/sign-in/email',
  '/sign-up/email',
  '/forget-password',
  '/email-otp/request-password-reset',
  '/email-otp/send-verification-otp',
])

export function captchaIsGuarded(method: string, path: string): boolean {
  if (method.toUpperCase() !== 'POST') return false
  return GUARDED_PATHS.has(path)
}

/**
 * Whether CAPTCHA is enabled for this deployment.
 *
 * The server's half of a decision the client makes from
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. The two used to be able to disagree, and the
 * server then rejected every login with 400 "CAPTCHA required" whenever the site
 * key was absent while the secret was set.
 *
 * Fails OPEN by design: an unset secret means "no CAPTCHA", not "reject
 * everything", so a missing or environment-scoped variable cannot lock users
 * out. The cost is that losing the variable silently removes a bot defence,
 * which is why callers log both enabling and skipping.
 */
export function isTurnstileConfigured(): boolean {
  const secret = process.env.TURNSTILE_SECRET_KEY
  return typeof secret === 'string' && secret.trim().length > 0
}

export async function verifyTurnstile(
  token: string,
  action: string,
): Promise<TurnstileVerifyResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY
  if (!secretKey || secretKey.trim().length === 0) {
    // Callers gate on isTurnstileConfigured() first. Reaching here means
    // verification was attempted with nothing to verify against, which cannot be
    // answered truthfully either way — so it throws rather than silently passing.
    throw new Error('TURNSTILE_SECRET_KEY is not configured')
  }

  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      // In the body, never a query string: a secret in a URL lands in access
      // logs and proxy caches.
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
        ...(action ? { action } : {}),
      }).toString(),
    },
  )

  // Distinguished from "token rejected" deliberately. The caller decides whether
  // a Cloudflare outage should block sign-in, and it cannot decide that if an
  // outage and a bad token look the same.
  if (!response.ok) {
    throw new Error(`Cloudflare siteverify failed: ${response.status}`)
  }

  const data = (await response.json()) as {
    success: boolean
    'error-codes'?: string[]
  }
  return { success: data.success === true, errorCodes: data['error-codes'] }
}
