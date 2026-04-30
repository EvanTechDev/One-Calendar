import { betterAuth } from 'better-auth'
import { prisma } from '@/lib/prisma'

export const betterAuthServer = betterAuth({
  database: prisma,
  emailAndPassword: {
    enabled: false,
  },
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
})
