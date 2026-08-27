const publicOrigin = (
  process.env.NEXT_PUBLIC_BASE_URL ??
  process.env.BETTER_AUTH_URL ??
  'http://localhost:3000'
).replace(/\/$/, '')

export const MCP_RESOURCE = `${publicOrigin}/api/mcp`
export const MCP_ISSUER = `${publicOrigin}/api/auth`
export const MCP_JWKS_URL = `${MCP_ISSUER}/jwks`
export const MCP_RESOURCE_METADATA_URL = `${publicOrigin}/.well-known/oauth-protected-resource/api/mcp`
