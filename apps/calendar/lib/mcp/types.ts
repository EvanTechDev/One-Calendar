export interface McpAuthUser {
  userId: string
  email: string
  name: string
  scopes: string[]
  authType: 'api_key' | 'oauth'
  keyId?: string
}

export type McpScope =
  | 'events:read'
  | 'events:write'
  | 'categories:read'
  | 'categories:write'
  | 'countdowns:read'
  | 'countdowns:write'
  | 'settings:read'
  | 'settings:write'
  | 'profile:read'

export const ALL_SCOPES: McpScope[] = [
  'events:read',
  'events:write',
  'categories:read',
  'categories:write',
  'countdowns:read',
  'countdowns:write',
  'settings:read',
  'settings:write',
  'profile:read',
]

export function hasScope(user: McpAuthUser, requiredScope: McpScope): boolean {
  return user.scopes.includes(requiredScope)
}

export function requireScope(user: McpAuthUser, requiredScope: McpScope): void {
  if (!hasScope(user, requiredScope)) {
    throw new McpAuthError(`Missing required scope: ${requiredScope}`, 403)
  }
}

export class McpAuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401,
  ) {
    super(message)
    this.name = 'McpAuthError'
  }
}

export interface AuditEntry {
  userId: string
  authType: 'api_key' | 'oauth'
  keyId?: string
  action: string
  resourceType?: string
  resourceId?: string
  ipAddress?: string
  userAgent?: string
  success: boolean
  errorMessage?: string
}
