import { betterAuth } from 'better-auth'
import { prismaAdapter } from '@better-auth/prisma-adapter'
import { emailOTP } from 'better-auth/plugins'
import { prisma } from '@/lib/prisma'
import { APP_CONFIG } from '@/lib/config'
import { Resend } from 'resend'
import bcrypt from 'bcryptjs'
import { renderAuthEmailTemplate } from '@/lib/auth-email-template'

const resendKey = process.env.RESEND_API_KEY
const resend = resendKey ? new Resend(resendKey) : null

async function sendAuthEmail(payload: {
  to: string
  subject: string
  html: string
}) {
  if (!resend) {
    throw new Error('RESEND_API_KEY is not configured')
  }
  const result = await resend.emails.send({
    from: APP_CONFIG.auth.resend.sender,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  })
  if (result.error) throw new Error(result.error.message)
  if (!result.data?.id) throw new Error('Email provider did not return a message id')
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    password: {
      hash: async (password) => bcrypt.hash(password, 10),
      verify: async ({ hash, password }) => bcrypt.compare(password, hash),
    },
    sendResetPassword: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email,
        subject: 'Reset your password',
        html: renderAuthEmailTemplate({
          preview: 'Reset your One Calendar password',
          title: 'Reset your password',
          body: 'We received a request to reset your password. Use the button below to continue.',
          actionLabel: 'Reset password',
          actionUrl: url,
          secondary: 'If you did not request this, you can safely ignore this email.',
        }),
      })
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email,
        subject: 'Verify your email',
        html: renderAuthEmailTemplate({
          preview: 'Verify your One Calendar email',
          title: 'Verify your email',
          body: 'Confirm your email address to finish setting up your account.',
          actionLabel: 'Verify email',
          actionUrl: url,
        }),
      })
    },
  },
  plugins: [
    emailOTP({
      sendVerificationOTP: async ({ email, otp, type }) => {
        await sendAuthEmail({
          to: email,
          subject: type === 'forget-password' ? 'Reset code' : 'Verification code',
          html: renderAuthEmailTemplate({
            preview:
              type === 'forget-password'
                ? 'Your One Calendar reset code'
                : 'Your One Calendar verification code',
            title:
              type === 'forget-password'
                ? 'Reset code'
                : 'Verification code',
            body: `Use this code to continue: ${otp}`,
            secondary: 'This code will expire shortly for your security.',
          }),
        })
      },
    }),
  ],
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL as string].filter(Boolean),
})
