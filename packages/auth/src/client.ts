import type { CreateAuthClientOptions } from './types'

export { createAuthClient } from 'better-auth/react'
export { emailOTPClient, twoFactorClient } from 'better-auth/client/plugins'
export { sentinelClient } from '@better-auth/infra/client'
export {
  oauthDeviceAuthorizationClient,
  oauthProviderClient,
} from '@better-auth/oauth-provider/client'

export type { CreateAuthClientOptions }
