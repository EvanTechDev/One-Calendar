import { betterAuth } from 'better-auth'
import { twoFactor, emailOTP } from 'better-auth/plugins'
import { sentinel } from '@better-auth/infra'
import { createDrizzleAdapter } from './adapter'
import type {
  CreateAuthOptions,
  EmailOTPOptions,
  EnabledPlugins,
  PluginOptions,
  SentinelOptions,
  TwoFactorOptions,
} from './types'

function resolveTwoFactorPlugin(options: PluginOptions) {
  const value = options.twoFactor
  if (value === undefined || value === false) return null
  const defaults: TwoFactorOptions = { issuer: 'App' }
  const merged = value === true ? defaults : { ...defaults, ...value }
  return () => twoFactor(merged)
}

function resolveSentinelPlugin(options: PluginOptions) {
  const value = options.sentinel
  if (value === undefined || value === false) return null
  const defaults: SentinelOptions = {
    apiKey: undefined,
    security: {
      credentialStuffing: { enabled: true },
      compromisedPassword: { enabled: true },
      botBlocking: { action: 'challenge' },
      emailValidation: { enabled: true },
    },
  }
  const merged =
    value === true
      ? defaults
      : {
          ...defaults,
          ...value,
          security: {
            ...defaults.security,
            ...value.security,
          },
        }
  return () => sentinel(merged)
}

function resolveEmailOTPPlugin(options: PluginOptions) {
  const value = options.emailOTP
  if (value === undefined || value === false) return null
  const defaults: EmailOTPOptions = { changeEmail: { enabled: true } }
  const merged = value === true ? defaults : { ...defaults, ...value }
  return (sendVerificationOTP?: any) =>
    emailOTP({ ...merged, sendVerificationOTP })
}

export function createAuth(options: CreateAuthOptions): {
  auth: ReturnType<typeof betterAuth>
  enabledPlugins: EnabledPlugins
} {
  const {
    db,
    baseURL,
    trustedOrigins,
    emailCallbacks,
    plugins = {},
    password,
    secret,
    disableCsrfCheck,
    isDev = false,
    additionalFields,
    afterHooks,
  } = options

  const adapter = createDrizzleAdapter(db, { provider: 'pg' })

  const resolvedPlugins: any[] = []
  const enabledPlugins: EnabledPlugins = {}

  const twoFactorFn = resolveTwoFactorPlugin(plugins)
  if (twoFactorFn) {
    resolvedPlugins.push(twoFactorFn())
    enabledPlugins.twoFactor = true
  }

  const sentinelFn = resolveSentinelPlugin(plugins)
  if (sentinelFn) {
    resolvedPlugins.push(sentinelFn())
    enabledPlugins.sentinel = true
  }

  const emailOTPFn = resolveEmailOTPPlugin(plugins)
  if (emailOTPFn) {
    if (!emailCallbacks.sendVerificationOTP && isDev) {
      console.warn(
        '[createAuth] emailOTP plugin is enabled but emailCallbacks.sendVerificationOTP is not provided. OTPs will be logged to console instead of sent via email.',
      )
    }
    resolvedPlugins.push(emailOTPFn(emailCallbacks.sendVerificationOTP))
    enabledPlugins.emailOTP = true
  }

  const authConfig: any = {
    database: adapter,
    secret,
    disableCsrfCheck,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      password,
      sendResetPassword: emailCallbacks.sendResetPassword,
    },
    emailVerification: {
      sendVerificationEmail: emailCallbacks.sendVerificationEmail,
      ...(emailCallbacks.sendChangeEmailVerification
        ? {
            sendChangeEmailVerification:
              emailCallbacks.sendChangeEmailVerification,
          }
        : {}),
    },
    plugins: resolvedPlugins,
    trustedOrigins,
  }

  if (additionalFields) {
    authConfig.user = {
      additionalFields,
    }
  }

  if (afterHooks) {
    authConfig.hooks = {
      after: afterHooks,
    }
  }

  if (baseURL) {
    authConfig.baseURL = baseURL
  }

  return {
    auth: betterAuth(authConfig),
    enabledPlugins,
  }
}
