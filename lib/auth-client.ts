'use client'

import { createAuthClient } from 'better-auth/react'
import { emailOTPClient, twoFactorClient } from 'better-auth/client/plugins'
import { sentinelClient } from '@better-auth/infra/client'

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [emailOTPClient(), twoFactorClient(), sentinelClient({ autoSolveChallenge: true })],
})
