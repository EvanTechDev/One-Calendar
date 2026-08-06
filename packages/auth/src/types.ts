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
  otpLength?: number
  expiresIn?: number
}

export interface PluginOptions {
  twoFactor?: boolean | TwoFactorOptions
  sentinel?: boolean | SentinelOptions
  emailOTP?: boolean | EmailOTPOptions
}

export interface PasswordHashOptions {
  hash: (password: string) => Promise<string>
  verify: (input: { hash: string; password: string }) => Promise<boolean>
}

export interface CreateAuthOptions {
  db: any
  baseURL?: string
  trustedOrigins: string[]
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
}

export interface CreateAuthClientOptions {
  baseURL?: string
  enabledPlugins?: EnabledPlugins
  plugins?: BetterAuthClientPlugin[]
}
