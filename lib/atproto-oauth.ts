export type AtprotoOauthConfig = {
  baseUrl: string
  clientId: string
  redirectUri: string
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "")
}

export function getAtprotoOauthConfig(requestUrl?: string): AtprotoOauthConfig | null {
  const configuredBaseUrl = process.env.ATPROTO_OAUTH_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL
  const originFromRequest = requestUrl ? new URL(requestUrl).origin : undefined
  const baseUrl = configuredBaseUrl || originFromRequest

  if (!baseUrl) return null

  const normalizedBaseUrl = trimTrailingSlash(baseUrl)
  const redirectUri = process.env.ATPROTO_OAUTH_REDIRECT_URI || `${normalizedBaseUrl}/api/atproto/oauth/callback`
  const explicitClientId = process.env.ATPROTO_OAUTH_CLIENT_ID
  const metadataBaseUrl = process.env.ATPROTO_OAUTH_CLIENT_METADATA_BASE_URL
  const vercelDeploymentUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined
  const fallbackMetadataBaseUrl = metadataBaseUrl || vercelDeploymentUrl || normalizedBaseUrl
  const clientId = explicitClientId || `${trimTrailingSlash(fallbackMetadataBaseUrl)}/oauth/client-metadata`

  return {
    baseUrl: normalizedBaseUrl,
    clientId,
    redirectUri,
  }
}
