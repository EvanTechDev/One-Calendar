import type { BetterAuthClientPlugin } from 'better-auth/client'

export type AuthInstance = ReturnType<typeof import('better-auth').betterAuth>

export interface SessionUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string | null
  twoFactorEnabled?: boolean | null
  createdAt: Date
  updatedAt: Date
}

export interface SessionData {
  id: string
  expiresAt: Date
  token: string
  createdAt: Date
  updatedAt: Date
  ipAddress?: string | null
  userAgent?: string | null
  userId: string
}

export interface AuthSession {
  user: SessionUser
  session: SessionData
}

export interface EmailCallbacks {
  sendResetPassword: (input: {
    user: { email?: string | null }
    url: string
  }) => Promise<void>
  sendVerificationEmail: (input: {
    user: { email?: string | null }
    url: string
  }) => Promise<void>
  sendChangeEmailVerification?: (input: {
    user: { email?: string | null }
    newEmail: string
    url: string
  }) => Promise<void>
  sendVerificationOTP?: (input: {
    email: string
    otp: string
    type: string
  }) => Promise<void>
}

export interface TwoFactorOptions {
  issuer?: string
  otpLength?: number
  trustDeviceMaxAge?: number
}

export interface SentinelOptions {
  apiKey?: string
  security?: {
    credentialStuffing?: { enabled: boolean }
    compromisedPassword?: { enabled: boolean }
    botBlocking?: { action: 'challenge' | 'block' | 'log' }
    emailValidation?: { enabled: boolean }
  }
}

export interface EmailOTPOptions {
  changeEmail?: { enabled: boolean }
  overrideDefaultEmailVerification?: boolean
  otpLength?: number
  expiresIn?: number
}

export interface McpOAuthOptions {
  resource: string
  loginPage: string
  consentPage: string
  verificationUri: string
  scopes: string[]
  accessTokenExpiresIn?: number
  refreshTokenExpiresIn?: number
}

export interface PluginOptions {
  twoFactor?: boolean | TwoFactorOptions
  sentinel?: boolean | SentinelOptions
  emailOTP?: boolean | EmailOTPOptions
  mcpOAuth?: McpOAuthOptions
}

export interface PasswordHashOptions {
  hash: (password: string) => Promise<string>
  verify: (input: { hash: string; password: string }) => Promise<boolean>
}

/**
 * Better Auth's `advanced` block, narrowed to what this monorepo uses.
 *
 * Cross-subdomain cookies are the only way two apps on sibling subdomains
 * (calendar + meet) can see one session: Better Auth emits no cookie `Domain`
 * attribute at all unless `crossSubDomainCookies.enabled` is set, so without
 * this passthrough a meet visitor is always anonymous no matter what the
 * apps' baseURLs say. This only works within one registered domain — a
 * cookie can never be shared across two different registered domains.
 */
export interface AdvancedOptions {
  crossSubDomainCookies?: {
    enabled: boolean
    /** e.g. `.zntr.app` — the shared parent both apps sit under. */
    domain?: string
  }
  cookiePrefix?: string
}

export interface CreateAuthOptions {
  db: any
  baseURL?: string
  trustedOrigins: string[]
  advanced?: AdvancedOptions
  emailCallbacks: EmailCallbacks
  plugins?: PluginOptions
  password: PasswordHashOptions
  secret?: string
  disableCsrfCheck?: boolean
  isDev?: boolean
}

export type EnabledPlugins = {
  twoFactor?: boolean
  sentinel?: boolean
  emailOTP?: boolean
  mcpOAuth?: boolean
}

export interface CreateAuthClientOptions {
  baseURL?: string
  enabledPlugins?: EnabledPlugins
  plugins?: BetterAuthClientPlugin[]
}
