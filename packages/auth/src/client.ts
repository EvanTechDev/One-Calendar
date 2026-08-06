import type { CreateAuthClientOptions } from './types.js'

export { createAuthClient } from 'better-auth/react'
export { emailOTPClient, twoFactorClient } from 'better-auth/client/plugins'
export { sentinelClient } from '@better-auth/infra/client'

export type { CreateAuthClientOptions }
