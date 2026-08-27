import { and, eq } from 'drizzle-orm'
import { type McpAuthUser, McpAuthError } from './types'
import { getUserNameAndEmail, verifyApiKey } from './auth'
import { getDb } from '@/lib/drizzle/client'
import { oauthClient, oauthConsent } from '@zntr/auth/schema'

export async function getMcpApiKeyAuth(
  request: Request,
): Promise<{ user: McpAuthUser; token: string } | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null

  const parts = authHeader.split(' ')
  const scheme = parts[0]?.toLowerCase()
  const token = parts.slice(1).join(' ')

  if (!token) return null

  if (scheme !== 'bearer') return null

  if (!token.startsWith('zc_')) return null
  const user = await verifyApiKey(token)

  if (!user) return null

  return { user, token }
}

export async function getMcpOAuthAuth(
  claims: {
    sub?: unknown
    client_id?: unknown
    azp?: unknown
    scope?: unknown
  },
  resource: string,
): Promise<McpAuthUser | null> {
  const userId = typeof claims.sub === 'string' ? claims.sub : null
  const clientId =
    typeof claims.client_id === 'string'
      ? claims.client_id
      : typeof claims.azp === 'string'
        ? claims.azp
        : null
  const scopes =
    typeof claims.scope === 'string'
      ? claims.scope.split(' ').filter(Boolean)
      : []
  if (!userId || !clientId || scopes.length === 0) return null

  const db = getDb()
  const [client] = await db
    .select({ disabled: oauthClient.disabled })
    .from(oauthClient)
    .where(eq(oauthClient.clientId, clientId))
  if (!client || client.disabled) return null

  const [consent] = await db
    .select({ resources: oauthConsent.resources, scopes: oauthConsent.scopes })
    .from(oauthConsent)
    .where(
      and(eq(oauthConsent.userId, userId), eq(oauthConsent.clientId, clientId)),
    )
  if (
    !consent ||
    !consent.resources?.includes(resource) ||
    !scopes.every((scope) => consent.scopes.includes(scope))
  ) {
    return null
  }

  const userInfo = await getUserNameAndEmail(userId)
  if (!userInfo.email) return null
  return {
    userId,
    email: userInfo.email,
    name: userInfo.name,
    scopes,
    authType: 'oauth',
    keyId: clientId,
  }
}

export async function requireMcpAuth(
  request: Request,
): Promise<{ user: McpAuthUser; token: string }> {
  const result = await getMcpApiKeyAuth(request)
  if (!result) {
    throw new McpAuthError('Unauthorized', 401)
  }
  return result
}
