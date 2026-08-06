export { createAuth } from './server.js'
export { createAuthClient } from './client.js'
export { createDrizzleAdapter } from './adapter.js'
export {
  authSchema,
  user,
  session,
  account,
  verification,
  twoFactor,
} from './schema.js'
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
} from './types.js'
