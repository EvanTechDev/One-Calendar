import { betterAuth } from 'better-auth'
import { prismaAdapter } from '@better-auth/prisma-adapter'
import { emailOTP } from 'better-auth/plugins'
import { prisma } from '@/lib/prisma'
import { APP_CONFIG } from '@/lib/config'
import { Resend } from 'resend'
import bcrypt from 'bcryptjs'

const resendKey = process.env.RESEND_API_KEY
const resend = resendKey ? new Resend(resendKey) : null

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
      if (!resend) return
      await resend.emails.send({
        from: APP_CONFIG.auth.resend.sender,
        to: user.email,
        subject: 'Reset your password',
        html: `<p>Reset password link:</p><p><a href="${url}">${url}</a></p>`,
      })
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      if (!resend) return
      await resend.emails.send({
        from: APP_CONFIG.auth.resend.sender,
        to: user.email,
        subject: 'Verify your email',
        html: `<p>Verify your email:</p><p><a href="${url}">${url}</a></p>`,
      })
    },
  },
  plugins: [
    emailOTP({
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (!resend) return
        await resend.emails.send({
          from: APP_CONFIG.auth.resend.sender,
          to: email,
          subject: type === 'forget-password' ? 'Reset code' : 'Verification code',
          html: `<p>Your code is: <strong>${otp}</strong></p>`,
        })
      },
    }),
  ],
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL as string].filter(Boolean),
})
