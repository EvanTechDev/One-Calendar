import { APP_CONFIG } from '@/lib/config'

export const OAUTH_PROVIDER_CONFIG = {
  microsoft: {
    strategy: 'oauth_microsoft',
    label: 'Microsoft',
  },
  google: {
    strategy: 'oauth_google',
    label: 'Google',
  },
  github: {
    strategy: 'oauth_github',
    label: 'GitHub',
  },
} as const

export type OAuthProviderKey = keyof typeof OAUTH_PROVIDER_CONFIG
export type OAuthStrategy =
  (typeof OAUTH_PROVIDER_CONFIG)[OAuthProviderKey]['strategy']

export function getEnabledOAuthProviderKeys(): OAuthProviderKey[] {
  const parsed = APP_CONFIG.auth.enabledOAuthProviders
    .map((provider) => provider.trim().toLowerCase())
    .filter(
      (provider): provider is OAuthProviderKey =>
        provider in OAUTH_PROVIDER_CONFIG,
    )
  return [...new Set(parsed)]
}
