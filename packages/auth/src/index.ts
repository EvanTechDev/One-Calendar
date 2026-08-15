export { createAuth } from './server'
export { createAuthClient } from './client'
export { createDrizzleAdapter } from './adapter'
export {
  authSchema,
  user,
  session,
  account,
  verification,
  twoFactor,
} from './schema'
export { getSessionCookie } from 'better-auth/cookies'
export { toNextJsHandler } from 'better-auth/next-js'
export type {
  AuthInstance,
  AuthSession,
  CreateAuthClientOptions,
  CreateAuthOptions,
  EmailCallbacks,
  EmailOTPOptions,
  EnabledPlugins,
  PluginOptions,
  PasswordHashOptions,
  SentinelOptions,
  SessionData,
  SessionUser,
  TwoFactorOptions,
} from './types'
