import { NextResponse } from 'next/server'

const MCP_BASE_URL = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

export async function GET() {
  return NextResponse.json({
    resource: MCP_BASE_URL,
    authorization_servers: [MCP_BASE_URL],
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
      'bookmarks:read',
      'bookmarks:write',
    ],
    bearer_methods_supported: ['header'],
  })
}
