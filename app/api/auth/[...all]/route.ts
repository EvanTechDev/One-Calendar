import { toNextJsHandler } from 'better-auth/next-js'
import { betterAuthServer } from '@/lib/auth/better-auth'

export const { GET, POST } = toNextJsHandler(betterAuthServer)
