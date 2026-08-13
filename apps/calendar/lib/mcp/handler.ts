import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { createServer } from './server'
import { getMcpAuth } from './auth-helpers'
import { logAudit } from './audit'
import { getMcpSettings } from './settings'
import { checkRateLimit } from './rate-limiter'
import { McpAuthError } from './types'

function allowedOrigins(): string[] {
  const appOrigin = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
  const configured = (process.env.MCP_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return [appOrigin, ...configured]
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  try {
    const auth = await getMcpAuth(request)

    if (request.method === 'GET') {
      const origin = request.headers.get('origin')
      const list = allowedOrigins()
      if (origin && list.length > 0 && !list.includes(origin)) {
        return Response.json({ error: 'origin_not_allowed' }, { status: 403 })
      }

      const server = createServer()
      const transport = new WebStandardStreamableHTTPServerTransport({
        enableJsonResponse: true,
        allowedOrigins: allowedOrigins(),
      })
      await server.connect(transport)
      return transport.handleRequest(
        request,
        auth
          ? {
              authInfo: {
                token: auth.token,
                clientId: `user:${auth.user.userId}`,
                scopes: auth.user.scopes,
                extra: {
                  userId: auth.user.userId,
                  clientId: auth.user.keyId ?? auth.user.authType,
                  authType: auth.user.authType,
                },
              },
            }
          : undefined,
      )
    }

    if (!auth) {
      return Response.json(
        { error: 'unauthorized' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
      )
    }

    const settings = await getMcpSettings(auth.user.userId)
    if (!settings.enabled) {
      return Response.json(
        { error: 'MCP is disabled for this account' },
        { status: 403 },
      )
    }

    const rateLimit = await checkRateLimit(auth.user.userId)
    if (!rateLimit.allowed) {
      await logAudit({
        userId: auth.user.userId,
        authType: auth.user.authType,
        keyId: auth.user.keyId,
        action: 'rate_limited',
        success: false,
        errorMessage: 'Rate limit exceeded',
        ipAddress: request.headers.get('x-forwarded-for') ?? '',
        userAgent: request.headers.get('user-agent') ?? '',
      })
      return Response.json(
        {
          error: 'rate_limited',
          retry_after: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        },
        { status: 429 },
      )
    }

    const authInfo: AuthInfo = {
      token: auth.token,
      clientId: `user:${auth.user.userId}`,
      scopes: auth.user.scopes,
      extra: {
        userId: auth.user.userId,
        clientId: auth.user.keyId ?? auth.user.authType,
        authType: auth.user.authType,
      },
    }

    const clientIp =
      request.headers.get('cf-connecting-ip') ??
      request.headers.get('x-forwarded-for') ??
      request.headers.get('x-real-ip') ??
      ''
    const userAgent = request.headers.get('user-agent') ?? ''

    const server = createServer()
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
      allowedOrigins: allowedOrigins(),
    })

    await server.connect(transport)

    try {
      const response = await transport.handleRequest(request, { authInfo })

      await logAudit({
        userId: auth.user.userId,
        authType: auth.user.authType,
        keyId: auth.user.keyId,
        action: 'mcp_request',
        success: response.status < 400,
        errorMessage: response.status >= 400 ? 'HTTP ' + response.status : undefined,
        ipAddress: clientIp,
        userAgent,
      })

      return response
    } catch (mcpErr) {
      await logAudit({
        userId: auth.user.userId,
        authType: auth.user.authType,
        keyId: auth.user.keyId,
        action: 'mcp_request',
        success: false,
        errorMessage: String(mcpErr),
        ipAddress: clientIp,
        userAgent,
      })
      throw mcpErr
    }
  } catch (err) {
    if (err instanceof McpAuthError) {
      return Response.json({ error: err.message }, { status: err.statusCode })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
