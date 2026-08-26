import { createAuthPortal } from '@zntr/auth/portal'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/drizzle'
import type { PortalInstance } from '@zntr/auth'

/**
 * The authorization server (ADR 0021).
 *
 * Deliberately NOT configured with cross-subdomain cookies. The portal's session
 * cookie is host-only and belongs to the portal alone: a client app learns who
 * the user is through an access token, never by reading a cookie. That is what
 * lets the apps live on different registered domains, and it removes the class
 * of failure where three environment variables had to be byte-identical across
 * apps or a user was silently anonymous in one of them.
 *
 * Instantiated lazily so a build without environment variables does not fail at
 * module load — the same reason meet does this.
 */
let instance: PortalInstance | null = null

export function getPortal(): PortalInstance {
  if (!instance) {
    instance = createAuthPortal({
      db: getDb(),
      // Thrown on by the factory when absent: the portal signs every token it
      // issues, and the baseURL is the OAuth issuer.
      secret: process.env.BETTER_AUTH_SECRET!,
      baseURL: process.env.NEXT_PUBLIC_BASE_URL!,
      // The origins allowed to start an authorization flow. A client not listed
      // here cannot begin one, which is the CSRF boundary.
      trustedOrigins: clientOrigins(),
      password: {
        hash: async (password: string) => bcrypt.hash(password, 10),
        // The cost factor must match what the calendar used when these hashes
        // were created, or every existing user's password stops verifying.
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
        sendVerificationOTP: async () => {},
      },
      sentinelApiKey: process.env.BETTER_AUTH_API_KEY,
      isDev: process.env.NODE_ENV !== 'production',
    })
  }
  return instance
}

/**
 * Origins permitted to start an authorization flow.
 *
 * Read from the environment rather than hard-coded so a new client does not
 * require a code change, but filtered to absolute origins: a relative or empty
 * value in this list would widen the CSRF boundary rather than narrow it.
 */
function clientOrigins(): string[] {
  return (process.env.AUTH_CLIENT_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter((origin) => /^https?:\/\/.+/.test(origin))
}
