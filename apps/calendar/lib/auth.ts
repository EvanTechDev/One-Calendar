import { createAuth } from '@zntr/auth/server'
import { getDb } from '@/lib/drizzle/client'
import bcrypt from 'bcryptjs'
import { renderAuthEmailTemplate } from '@/lib/auth/email-template'
import { sendAuthEmail } from '@/lib/auth/send-auth-email'
import { sendWelcomeEmail } from '@/lib/auth/send-welcome-email'

const baseURL = process.env.NEXT_PUBLIC_BASE_URL

const { auth } = createAuth({
  db: getDb(),
  ...(baseURL ? { baseURL } : {}),
  trustedOrigins: baseURL ? [baseURL] : [],
  password: {
    hash: async (password: string) => bcrypt.hash(password, 10),
    verify: async ({ hash, password }: { hash: string; password: string }) =>
      bcrypt.compare(password, hash),
  },
  user: {
    additionalFields: {
      onboardingCompleted: {
        type: 'boolean',
        required: true,
        defaultValue: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (_user) => {
          // No-op for now - could be used for future onboarding setup
        },
      },
    },
  },
  afterHooks: async (ctx) => {
    if (ctx.path === '/email-otp/verify-email' && ctx.context?.returned) {
      const returned = ctx.context.returned as { user?: { email?: string } }
      const email = returned.user?.email
      if (email) {
        try {
          await sendWelcomeEmail(email)
        } catch {
          // Don't fail the verification flow if email sending fails
        }
      }
    }
  },
  emailCallbacks: {
    sendResetPassword: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email ?? '',
        subject: 'Reset your password',
        html: await renderAuthEmailTemplate({
          preview: 'Reset your One Calendar password',
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
          preview: 'Verify your One Calendar email',
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
          preview: 'Confirm your One Calendar email change',
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
              ? 'Your One Calendar reset code'
              : 'Your One Calendar verification code',
          title:
            type === 'forget-password' ? 'Reset code' : 'Verification code',
          body:
            type === 'forget-password'
              ? 'Use the code below to reset your password.'
              : 'Use the code below to continue with your One Calendar account.',
          code: otp,
          secondary: 'This code will expire shortly for your security.',
        }),
      })
    },
  },
  plugins: {
    twoFactor: { issuer: 'One Calendar' },
    sentinel: {
      apiKey: process.env.BETTER_AUTH_API_KEY,
      security: {
        credentialStuffing: { enabled: true },
        compromisedPassword: { enabled: true },
        botBlocking: { action: 'challenge' },
        emailValidation: { enabled: true },
      },
    },
    emailOTP: { changeEmail: { enabled: true } },
  },
  isDev: process.env.NODE_ENV !== 'production',
})

export { auth }
