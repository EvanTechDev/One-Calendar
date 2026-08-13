export type TurnstileVerifyResult = {
  success: boolean
  errorCodes?: string[]
}

export async function verifyTurnstile(
  token: string,
  action: string,
): Promise<TurnstileVerifyResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY
  if (!secretKey) {
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