import { NextResponse } from 'next/server'

const MCP_BASE_URL = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

export async function GET() {
  return NextResponse.json({
    issuer: MCP_BASE_URL,
    authorization_endpoint: `${MCP_BASE_URL}/oauth/authorize`,
    token_endpoint: `${MCP_BASE_URL}/api/oauth/token`,
    device_authorization_endpoint: `${MCP_BASE_URL}/api/oauth/device`,
    response_types_supported: ['code'],
    grant_types_supported: [
      'authorization_code',
      'urn:ietf:params:oauth:grant-type:device_code',
    ],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [
      'events:read',
      'events:write',
      'categories:read',
      'categories:write',
      'countdowns:read',
      'countdowns:write',
      'settings:read',
      'settings:write',
      'profile:read',
    ],
    code_challenge_methods_supported: ['S256'],
  })
}
