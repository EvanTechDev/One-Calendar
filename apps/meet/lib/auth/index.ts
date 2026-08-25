import { createAuth } from '@zntr/auth/server'
import { crossAppAuthConfig } from '@zntr/auth'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/drizzle'
import type { AuthInstance } from '@zntr/auth'

let _auth: AuthInstance | null = null

// Meet shares the calendar user database. Sign-up/password-reset emails
// are handled by the calendar app, so the callbacks here are inert; this
// instance mainly serves session reads. Instantiated lazily so builds
// without env vars don't fail at module load.
export function getAuth(): AuthInstance {
  if (!_auth) {
    const baseURL = process.env.NEXT_PUBLIC_BASE_URL
    // Must mirror the calendar's cookie configuration exactly, or the session
    // it created is invisible here and every visitor is anonymous.
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
      emailCallbacks: {
        sendResetPassword: async () => {},
        sendVerificationEmail: async () => {},
      },
      isDev: process.env.NODE_ENV !== 'production',
    })
    _auth = auth
  }
  return _auth
}
