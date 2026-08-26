/**
 * Re-exported from @zntr/auth so both apps verify CAPTCHA identically.
 *
 * This file was the original implementation; it moved to the package when meet
 * gained a sign-up surface (ADR 0022). Two copies of a security control is how
 * one of them keeps a fix and the other does not.
 */
export {
  isTurnstileConfigured,
  verifyTurnstile,
  captchaIsGuarded,
} from '@zntr/auth/turnstile'
export type { TurnstileVerifyResult } from '@zntr/auth/turnstile'
