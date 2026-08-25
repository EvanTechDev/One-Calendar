import { createAuth } from '@zntr/auth/server'
import { crossAppAuthConfig } from '@zntr/auth'
import { getDb } from '@/lib/drizzle/client'
import bcrypt from 'bcryptjs'
import { renderAuthEmailTemplate } from '@/lib/auth/email-template'
import { sendAuthEmail } from '@/lib/auth/send-auth-email'

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

  emailCallbacks: {
    sendResetPassword: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email ?? '',
        subject: 'Reset your password',
        html: await renderAuthEmailTemplate({
          preview: 'Reset your Zentra Calendar password',
          title: 'Reset your password',
          body: 'We received a request to reset your password. Use the button below to continue.',
          actionLabel: 'Reset password',
          actionUrl: url,
          secondary:
            'If you did not request this, you can safely ignore this email.',
        }),
      })
    },
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email ?? '',
        subject: 'Verify your email',
        html: await renderAuthEmailTemplate({
          preview: 'Verify your Zentra Calendar email',
          title: 'Verify your email',
          body: 'Confirm your email address to finish setting up your account.',
          actionLabel: 'Verify email',
          actionUrl: url,
        }),
      })
    },
    sendChangeEmailVerification: async ({ user, newEmail, url }) => {
      await sendAuthEmail({
        to: newEmail,
        subject: 'Confirm your new email',
        html: await renderAuthEmailTemplate({
          preview: 'Confirm your Zentra Calendar email change',
          title: 'Confirm your new email',
          body: `A request was made to change your account email from ${user.email} to ${newEmail}.`,
          actionLabel: 'Confirm email change',
          actionUrl: url,
          secondary: 'If this was not you, you can ignore this email.',
        }),
      })
    },
    sendVerificationOTP: async ({ email, otp, type }) => {
      await sendAuthEmail({
        to: email,
        subject:
          type === 'forget-password' ? 'Reset code' : 'Verification code',
        html: await renderAuthEmailTemplate({
          preview:
            type === 'forget-password'
              ? 'Your Zentra Calendar reset code'
              : 'Your Zentra Calendar verification code',
          title:
            type === 'forget-password' ? 'Reset code' : 'Verification code',
          body:
            type === 'forget-password'
              ? 'Use the code below to reset your password.'
              : 'Use the code below to continue with your Zentra Calendar account.',
          code: otp,
          secondary: 'This code will expire shortly for your security.',
        }),
      })
    },
  },
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
