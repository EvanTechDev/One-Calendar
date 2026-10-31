'use client'

import {
  createAuthClient,
  emailOTPClient,
  oauthProviderClient,
  sentinelClient,
  twoFactorClient,
} from '@zntr/auth/client'

const baseURL = process.env.NEXT_PUBLIC_APP_URL

/** OAuth-only client: its plugin interprets the current query as signed state. */
export const oauthAuthClient = createAuthClient({
  ...(baseURL ? { baseURL } : {}),
  plugins: [
    twoFactorClient(),
    sentinelClient({ autoSolveChallenge: true }),
    emailOTPClient(),
    oauthProviderClient(),
  ],
})
