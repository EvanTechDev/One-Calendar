export type TurnstileVerifyResult = {
  success: boolean
  errorCodes?: string[]
}

/**
 * Whether CAPTCHA is enabled for this deployment.
 *
 * Turnstile is optional: with no secret configured, sign-in and sign-up skip
 * the check entirely. This is the server's half of a decision the client makes
 * from `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — the two used to disagree, and the
 * server rejected every login with 400 "CAPTCHA required" whenever the site key
 * was absent while the server still demanded a token.
 *
 * This deliberately fails OPEN. An unset secret means "no CAPTCHA", not "reject
 * everything", so a missing or environment-scoped variable cannot lock users
 * out. The trade-off is that losing the variable silently removes a bot
 * defence, which is why enabling and skipping are both logged.
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
  if (!secretKey) {
    // Callers must gate on isTurnstileConfigured() first. Reaching here means
    // verification was attempted with no secret, which cannot be answered
    // truthfully either way — so it stays a throw rather than a silent pass.
    throw new Error('TURNSTILE_SECRET_KEY is not configured')
  }
  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
        ...(action ? { action } : {}),
      }).toString(),
    },
  )
  if (!response.ok)
    throw new Error(`Cloudflare siteverify failed: ${response.status}`)
  const data = (await response.json()) as {
    success: boolean
    'error-codes'?: string[]
  }
  return { success: data.success === true, errorCodes: data['error-codes'] }
}
