import { createAuth } from '@zntr/auth/server'
import { crossAppAuthConfig } from '@zntr/auth'
import { getDb } from '@/lib/drizzle/client'
import bcrypt from 'bcryptjs'
import { CALENDAR_EMAIL_BRAND } from '@/lib/auth/brand'
import { authEmailCallbacks, resendSender } from '@zntr/auth/email'

const baseURL = process.env.NEXT_PUBLIC_BASE_URL

// Zentra Meet reads the session established here. That needs a cookie scoped
// to the shared parent domain, which Better Auth only emits when asked —
// see @zntr/auth's crossAppAuthConfig for the two requirements it cannot
// work around.
const { advanced, trustedOrigins } = crossAppAuthConfig({
  cookieDomain: process.env.AUTH_COOKIE_DOMAIN,
  baseURL,
  siblingOrigin: process.env.NEXT_PUBLIC_MEET_ORIGIN,
})

const { auth } = createAuth({
  db: getDb(),
  ...(baseURL ? { baseURL } : {}),
  ...(advanced ? { advanced } : {}),
  trustedOrigins,
  password: {
    hash: async (password: string) => bcrypt.hash(password, 10),
    verify: async ({ hash, password }: { hash: string; password: string }) =>
      bcrypt.compare(password, hash),
  },

  emailCallbacks: authEmailCallbacks({
    brand: CALENDAR_EMAIL_BRAND,
    send: resendSender(),
  }),

  plugins: {
    twoFactor: {
      issuer: 'Zentra Calendar',
      trustDeviceMaxAge: 60 * 60 * 24 * 7, // 7 days, in seconds
    },
    sentinel: {
      apiKey: process.env.BETTER_AUTH_API_KEY,
      security: {
        credentialStuffing: { enabled: true },
        compromisedPassword: { enabled: true },
        botBlocking: { action: 'challenge' },
        emailValidation: { enabled: true },
      },
    },
    emailOTP: {
      changeEmail: { enabled: true },
      overrideDefaultEmailVerification: true,
    },
  },
  isDev: process.env.NODE_ENV !== 'production',
})

export { auth }
