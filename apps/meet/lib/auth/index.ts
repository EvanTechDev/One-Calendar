import { createAuth } from '@zntr/auth/server'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/drizzle'
import type { AuthInstance } from '@zntr/auth'

let _auth: AuthInstance | null = null

// Meet shares the one-calendar user database. Sign-up/password-reset emails
// are handled by the calendar app, so the callbacks here are inert; this
// instance mainly serves session reads. Instantiated lazily so builds
// without env vars don't fail at module load.
export function getAuth(): AuthInstance {
  if (!_auth) {
    const baseURL = process.env.NEXT_PUBLIC_BASE_URL
    const { auth } = createAuth({
      db: getDb(),
      ...(baseURL ? { baseURL } : {}),
      trustedOrigins: baseURL ? [baseURL] : [],
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
