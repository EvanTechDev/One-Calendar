import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { db } from '@/lib/drizzle/client'
import * as schema from '@/lib/drizzle/schema'
import { betterAuth } from 'better-auth'
import { emailOTP, twoFactor } from 'better-auth/plugins'
import { sentinel } from '@better-auth/infra'
import bcrypt from 'bcryptjs'
import { renderAuthEmailTemplate } from '@/lib/auth/email-template'
import { sendAuthEmail } from '@/lib/auth/send-auth-email'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    password: {
      hash: async (password: string) => bcrypt.hash(password, 10),
      verify: async ({ hash, password }: { hash: string; password: string }) =>
        bcrypt.compare(password, hash),
    },
    sendResetPassword: async ({
      user,
      url,
    }: {
      user: { email?: string }
      url: string
    }) => {
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
  },
  emailVerification: {
    sendVerificationEmail: async ({
      user,
      url,
    }: {
      user: { email?: string }
      url: string
    }) => {
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
    sendChangeEmailVerification: async ({
      user,
      newEmail,
      url,
    }: {
      user: { email?: string }
      newEmail: string
      url: string
    }) => {
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
  },
  plugins: [
    twoFactor({
      issuer: 'One Calendar',
    }),
    sentinel({
      apiKey: process.env.BETTER_AUTH_API_KEY,
      security: {
        credentialStuffing: { enabled: true },
        compromisedPassword: { enabled: true },
        botBlocking: { action: 'challenge' },
        emailValidation: { enabled: true },
      },
    }),
    emailOTP({
      sendVerificationOTP: async ({
        email,
        otp,
        type,
      }: {
        email: string
        otp: string
        type: string
      }) => {
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
            body: `Use this code to continue: ${otp}`,
            secondary: 'This code will expire shortly for your security.',
          }),
        })
      },
    }),
  ],
  trustedOrigins: [process.env.NEXT_PUBLIC_BASE_URL as string].filter(Boolean),
})
