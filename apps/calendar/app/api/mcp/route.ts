import { requireMcpAuth } from '@zntr/auth/server'
import { auth } from '@/lib/auth'
import { getMcpApiKeyAuth, getMcpOAuthAuth } from '@/lib/mcp/auth-helpers'
import { handleMcpRequest } from '@/lib/mcp/handler'
import {
  MCP_ISSUER,
  MCP_JWKS_URL,
  MCP_RESOURCE,
  MCP_RESOURCE_METADATA_URL,
} from '@/lib/mcp/oauth-config'
import { ALL_SCOPES } from '@/lib/mcp/types'

export const runtime = 'nodejs'

function unauthorized() {
  return Response.json(
    { error: 'unauthorized' },
    {
      status: 401,
      headers: {
        'WWW-Authenticate': `Bearer resource_metadata="${MCP_RESOURCE_METADATA_URL}"`,
      },
    },
  )
}

const handleOAuthRequest = requireMcpAuth(
  auth,
  async (request, claims) => {
    const user = await getMcpOAuthAuth(claims, MCP_RESOURCE)
    if (!user) return unauthorized()
    const token = request.headers.get('authorization')?.slice(7) ?? ''
    return handleMcpRequest(request, { user, token })
  },
  {
    resource: MCP_RESOURCE,
    issuer: MCP_ISSUER,
    jwksUrl: MCP_JWKS_URL,
    challengeScopes: ALL_SCOPES,
  },
)

async function dispatch(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1] ?? ''
  if (!token.startsWith('zc_')) return handleOAuthRequest(request)

  const apiKey = await getMcpApiKeyAuth(request)
  if (!apiKey) return unauthorized()
  return handleMcpRequest(request, apiKey)
}

export const GET = dispatch
export const POST = dispatch
