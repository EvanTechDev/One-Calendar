import {
  WebStandardStreamableHTTPServerTransport,
  type AuthInfo,
} from '@modelcontextprotocol/server'
import { createServer } from './server'
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

function allowedHosts(): string[] {
  return allowedOrigins().flatMap((origin) => {
    try {
      return [new URL(origin).hostname]
    } catch {
      return []
    }
  })
}

export async function handleMcpRequest(
  request: Request,
  auth: { user: import('./types').McpAuthUser; token: string },
): Promise<Response> {
  try {
    const origin = request.headers.get('origin')
    const list = allowedOrigins()
    if (origin && list.length > 0 && !list.includes(origin)) {
      return Response.json({ error: 'origin_not_allowed' }, { status: 403 })
    }
    const host = request.headers.get('host')?.split(':')[0]
    if (!host || !allowedHosts().includes(host)) {
      return Response.json({ error: 'host_not_allowed' }, { status: 403 })
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
        entryType: 'request',
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

    const clientIp =
      request.headers.get('cf-connecting-ip') ??
      request.headers.get('x-forwarded-for') ??
      request.headers.get('x-real-ip') ??
      ''
    const userAgent = request.headers.get('user-agent') ?? ''

    const authInfo: AuthInfo = {
      token: auth.token,
      clientId: `user:${auth.user.userId}`,
      scopes: auth.user.scopes,
      extra: {
        userId: auth.user.userId,
        email: auth.user.email,
        clientId: auth.user.keyId ?? auth.user.authType,
        authType: auth.user.authType,
        // Per-tool-call audit rows are written inside the tool handlers, which
        // only receive `authInfo` — so the request-scoped identity and client
        // details have to travel with it.
        keyId: auth.user.keyId,
        ipAddress: clientIp,
        userAgent,
      },
    }

    const server = createServer()
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
      allowedOrigins: allowedOrigins(),
      allowedHosts: allowedHosts(),
      enableDnsRebindingProtection: true,
      supportedProtocolVersions: ['2026-07-28'],
    })

    await server.connect(transport)

    try {
      const response = await transport.handleRequest(request, { authInfo })

      await logAudit({
        userId: auth.user.userId,
        authType: auth.user.authType,
        keyId: auth.user.keyId,
        action: 'mcp_request',
        entryType: 'request',
        success: response.status < 400,
        errorMessage:
          response.status >= 400 ? 'HTTP ' + response.status : undefined,
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
        entryType: 'request',
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
