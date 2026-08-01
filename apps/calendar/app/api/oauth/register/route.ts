import { NextRequest, NextResponse } from 'next/server'
import { registerOAuthClient } from '@/lib/mcp/auth'
import { McpAuthError } from '@/lib/mcp/types'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        {
          error: 'invalid_client_metadata',
          error_description: 'Request body must be valid JSON',
        },
        { status: 400 },
      )
    }

    const registered = await registerOAuthClient({
      redirect_uris: body.redirect_uris as string[],
      token_endpoint_auth_method: body.token_endpoint_auth_method as
        | string
        | undefined,
      grant_types: body.grant_types as string[] | undefined,
      response_types: body.response_types as string[] | undefined,
      client_name: body.client_name as string | undefined,
      client_uri: body.client_uri as string | undefined,
      logo_uri: body.logo_uri as string | undefined,
      scope: body.scope as string | undefined,
      contacts: body.contacts as string[] | undefined,
      tos_uri: body.tos_uri as string | undefined,
      policy_uri: body.policy_uri as string | undefined,
      jwks_uri: body.jwks_uri as string | undefined,
      jwks: body.jwks,
      software_id: body.software_id as string | undefined,
      software_version: body.software_version as string | undefined,
    })

    return NextResponse.json(
      {
        client_id: registered.clientId,
        client_secret: registered.clientSecret,
        client_id_issued_at: registered.clientIdIssuedAt,
        client_secret_expires_at: registered.clientSecretExpiresAt,
        redirect_uris: (body.redirect_uris as string[]) ?? [],
        token_endpoint_auth_method: body.token_endpoint_auth_method ?? 'none',
        grant_types: body.grant_types ?? [
          'authorization_code',
          'refresh_token',
        ],
        response_types: body.response_types ?? ['code'],
        client_name: body.client_name ?? 'MCP Client',
        scope: body.scope ?? '',
      },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof McpAuthError) {
      return NextResponse.json(
        {
          error: 'invalid_client_metadata',
          error_description: err.message,
        },
        { status: err.statusCode },
      )
    }
    return NextResponse.json(
      {
        error: 'server_error',
        error_description: 'Internal server error',
      },
      { status: 500 },
    )
  }
}
