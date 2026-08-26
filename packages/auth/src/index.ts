export { createAuth } from './server'
export { createAuthPortal } from './portal'
export {
  exposedPortalPaths,
  isAdminOnlyPath,
  portalPathIsExposed,
} from './route-policy'
export { buildPortalDiagnostics } from './diagnostics'
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
export {
  oauthProviderSchema,
  jwks,
  oauthClient,
  oauthResource,
  oauthClientResource,
  oauthRefreshToken,
  oauthAccessToken,
  oauthConsent,
  oauthClientAssertion,
} from './schema'
export { getSessionCookie } from 'better-auth/cookies'
export { toNextJsHandler } from 'better-auth/next-js'
export { crossAppAuthConfig } from './cross-app'
export type {
  AdvancedOptions,
  AuthInstance,
  AuthSession,
  CreateAuthClientOptions,
  CreateAuthOptions,
  CreatePortalOptions,
  EmailCallbacks,
  EmailOTPOptions,
  EnabledPlugins,
  PluginOptions,
  PasswordHashOptions,
  PortalInstance,
  SentinelOptions,
  SessionData,
  SessionUser,
  TwoFactorOptions,
} from './types'
