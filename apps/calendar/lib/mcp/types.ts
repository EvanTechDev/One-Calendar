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
  | 'bookmarks:read'
  | 'bookmarks:write'

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
  'bookmarks:read',
  'bookmarks:write',
]

export class McpAuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401,
  ) {
    super(message)
    this.name = 'McpAuthError'
  }
}

/**
 * 'request' rows are written once per HTTP request by the transport layer and
 * are what the Redis-fallback rate limiter counts. 'tool_call' rows are written
 * once per MCP tool invocation and carry the tool name plus, for mutations, a
 * redacted summary of what changed.
 */
export type AuditEntryType = 'request' | 'tool_call'

export interface AuditEntry {
  userId: string
  authType: 'api_key' | 'oauth'
  keyId?: string
  action: string
  entryType?: AuditEntryType
  toolName?: string
  resourceType?: string
  resourceId?: string
  isMutation?: boolean
  /** Redacted, e.g. { fields: ['title','startDate'], apply_to: 'single' }. */
  changes?: Record<string, unknown>
  durationMs?: number
  ipAddress?: string
  userAgent?: string
  success: boolean
  errorMessage?: string
}
