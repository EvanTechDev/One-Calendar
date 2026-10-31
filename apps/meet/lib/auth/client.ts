'use client'

import {
  createAuthClient,
  emailOTPClient,
  twoFactorClient,
} from '@zntr/auth/client'

/**
 * Meet's Better Auth client.
 *
 * Carries the same plugins as the calendar's, because it now mounts the same
 * sign-up form and account panel (ADR 0022): sign-up verifies the address with an
 * email OTP, and the panel's change-email and change-password flows use one too.
 * Without them the shared components would render a reduced surface here, which
 * is exactly the divergence sharing them was meant to remove.
 *
 * Sentinel is deliberately absent, matching the calendar: it only mounts when
 * BETTER_AUTH_API_KEY is set, and this deployment has never set it. A sentinel
 * plugin with no key rejects every sign-in with 401 "Missing API key".
 */
const baseURL = process.env.NEXT_PUBLIC_BASE_URL

export const authClient = createAuthClient({
  ...(baseURL ? { baseURL } : {}),
  plugins: [twoFactorClient(), emailOTPClient()],
})
