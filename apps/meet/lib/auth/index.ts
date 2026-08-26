import { createAuth } from '@zntr/auth/server'
import { crossAppAuthConfig } from '@zntr/auth'
import { authEmailCallbacks, resendSender } from '@zntr/auth/email'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/drizzle'
import { MEET_EMAIL_BRAND } from '@/lib/auth/brand'
import type { AuthInstance } from '@zntr/auth'

let _auth: AuthInstance | null = null

/**
 * Meet's Better Auth instance.
 *
 * Meet shares the calendar's user database, and now its sign-in surface too: it
 * mounts the same forms from `@zntr/auth` rather than linking away (ADR 0022).
 *
 * Two things changed as a result:
 *
 * - **The email callbacks are real.** They used to be
 *   `sendResetPassword: async () => {}`, on the assumption that only the calendar
 *   ever sent mail. With a sign-up form here, that assumption became a silent
 *   failure: registration succeeded and the verification mail went nowhere.
 * - **The plugins match the calendar's.** Sign-up verifies the address with an
 *   email OTP and the account panel's change-email flow needs one, so an absent
 *   plugin would leave this app rendering a reduced version of a shared component.
 *
 * Instantiated lazily so a build without env vars does not fail at module load.
 */
export function getAuth(): AuthInstance {
  if (!_auth) {
    const baseURL = process.env.NEXT_PUBLIC_BASE_URL
    // Must mirror the calendar's cookie configuration exactly, or the session it
    // created is invisible here and every visitor is anonymous.
    const { advanced, trustedOrigins } = crossAppAuthConfig({
      cookieDomain: process.env.AUTH_COOKIE_DOMAIN,
      baseURL,
      siblingOrigin: process.env.NEXT_PUBLIC_CALENDAR_ORIGIN,
    })
    const { auth } = createAuth({
      db: getDb(),
      ...(baseURL ? { baseURL } : {}),
      ...(advanced ? { advanced } : {}),
      trustedOrigins,
      // bcrypt with the same cost as the calendar: the two apps verify each
      // other's hashes, and a different algorithm here would lock every existing
      // user out of this app only.
      password: {
        hash: async (password: string) => bcrypt.hash(password, 10),
        verify: async ({
          hash,
          password,
        }: {
          hash: string
          password: string
        }) => bcrypt.compare(password, hash),
      },
      emailCallbacks: authEmailCallbacks({
        brand: MEET_EMAIL_BRAND,
        send: resendSender(),
      }),
      plugins: {
        twoFactor: {
          issuer: 'Zentra Meet',
          trustDeviceMaxAge: 60 * 60 * 24 * 7, // 7 days, in seconds
        },
        emailOTP: {
          changeEmail: { enabled: true },
          overrideDefaultEmailVerification: true,
        },
      },
      isDev: process.env.NODE_ENV !== 'production',
    })
    _auth = auth
  }
  return _auth
}
