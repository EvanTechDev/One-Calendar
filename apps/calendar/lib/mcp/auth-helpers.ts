import { type McpAuthUser, McpAuthError } from './types'
import { verifyApiKey, verifyOAuthToken } from './auth'

export async function getMcpAuth(
  request: Request,
): Promise<{ user: McpAuthUser; token: string } | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null

  const parts = authHeader.split(' ')
  const scheme = parts[0]?.toLowerCase()
  const token = parts.slice(1).join(' ')

  if (!token) return null

  if (scheme !== 'bearer') return null

  const user = token.startsWith('zc_')
    ? await verifyApiKey(token)
    : await verifyOAuthToken(token)

  if (!user) return null

  return { user, token }
}

export async function requireMcpAuth(
  request: Request,
): Promise<{ user: McpAuthUser; token: string }> {
  const result = await getMcpAuth(request)
  if (!result) {
    throw new McpAuthError('Unauthorized', 401)
  }
  return result
}
