'use client'

import {
  createAuthClient,
  emailOTPClient,
  twoFactorClient,
  sentinelClient,
  oauthDeviceAuthorizationClient,
} from '@zntr/auth/client'
import { enabledPlugins } from '@/lib/auth/enabled-plugins'

const baseURL = process.env.NEXT_PUBLIC_APP_URL

export const authClient = createAuthClient({
  ...(baseURL ? { baseURL } : {}),
  plugins: [
    ...(enabledPlugins.twoFactor ? [twoFactorClient()] : []),
    ...(enabledPlugins.sentinel
      ? [sentinelClient({ autoSolveChallenge: true })]
      : []),
    ...(enabledPlugins.emailOTP ? [emailOTPClient()] : []),
    ...(enabledPlugins.mcpOAuth ? [oauthDeviceAuthorizationClient()] : []),
  ],
})
