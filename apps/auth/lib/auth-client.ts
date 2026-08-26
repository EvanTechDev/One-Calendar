'use client'

import {
  createAuthClient,
  emailOTPClient,
  twoFactorClient,
} from '@zntr/auth/client'
import { oauthProviderClient } from '@better-auth/oauth-provider/client'

/**
 * The portal's own browser client.
 *
 * No `baseURL`: the portal's pages and its auth handler are the same origin, so
 * the default relative base is correct and there is no environment variable to
 * get wrong.
 *
 * Sentinel's client plugin is deliberately absent. It solves a hosted challenge,
 * and the server only mounts sentinel when an API key is configured — a client
 * plugin expecting a challenge the server never issues would break sign-in in
 * exactly the deployments that have no key.
 */
export const authClient = createAuthClient({
  plugins: [
    twoFactorClient(),
    emailOTPClient(),
    // Needed by the consent page: it resolves which client is asking from the
    // provider rather than from the query string.
    oauthProviderClient(),
  ],
})
