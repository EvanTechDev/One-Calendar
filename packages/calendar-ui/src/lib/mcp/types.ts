export interface McpAuthUser {
  userId: string
  email: string
  name: string
  scopes: string[]
  authType: 'api_key' | 'oauth'
  keyId?: string
}

export const MCP_SCOPE_GROUPS = [
  {
    resource: 'events',
    label: 'Events',
    description: 'Calendar events and recurrence',
    scopes: ['events:read', 'events:write'],
  },
  {
    resource: 'categories',
    label: 'Categories',
    description: 'Calendar categories',
    scopes: ['categories:read', 'categories:write'],
  },
  {
    resource: 'countdowns',
    label: 'Countdowns',
    description: 'Countdown widgets',
    scopes: ['countdowns:read', 'countdowns:write'],
  },
  {
    resource: 'bookmarks',
    label: 'Bookmarks',
    description: 'Bookmarked events',
    scopes: ['bookmarks:read', 'bookmarks:write'],
  },
  {
    resource: 'settings',
    label: 'Settings',
    description: 'Preferences and timezone',
    scopes: ['settings:read', 'settings:write'],
  },
  {
    resource: 'profile',
    label: 'Profile',
    description: 'Name, email and avatar',
    scopes: ['profile:read'],
  },
] as const

export type McpScope = (typeof MCP_SCOPE_GROUPS)[number]['scopes'][number]

export const ALL_SCOPES: McpScope[] = MCP_SCOPE_GROUPS.flatMap((group) => [
  ...group.scopes,
])

export type McpPermissionGroup = {
  resources: string[]
  badge: 'READ+WRITE' | 'READ' | 'WRITE' | 'LONG-LIVED' | 'REQUESTED'
}

/** Converts protocol scopes into the user-facing consent disclosure. */
export function groupMcpPermissions(scopes: string[]): McpPermissionGroup[] {
  const requested = new Set(scopes)
  const readWrite: string[] = []
  const readOnly: string[] = []
  const writeOnly: string[] = []
  const recognized = new Set<string>(['offline_access'])

  for (const group of MCP_SCOPE_GROUPS) {
    const readScope = group.scopes.find((scope) => scope.endsWith(':read'))
    const writeScope = group.scopes.find((scope) => scope.endsWith(':write'))
    if (readScope) recognized.add(readScope)
    if (writeScope) recognized.add(writeScope)

    const canRead = Boolean(readScope && requested.has(readScope))
    const canWrite = Boolean(writeScope && requested.has(writeScope))
    if (canRead && canWrite) readWrite.push(group.label)
    else if (canRead) readOnly.push(group.label)
    else if (canWrite) writeOnly.push(group.label)
  }

  const unknown = scopes.filter((scope) => !recognized.has(scope)).sort()
  return [
    ...(readWrite.length
      ? [{ resources: readWrite, badge: 'READ+WRITE' as const }]
      : []),
    ...(readOnly.length
      ? [{ resources: readOnly, badge: 'READ' as const }]
      : []),
    ...(writeOnly.length
      ? [{ resources: writeOnly, badge: 'WRITE' as const }]
      : []),
    ...(requested.has('offline_access')
      ? [{ resources: ['Offline access'], badge: 'LONG-LIVED' as const }]
      : []),
    ...(unknown.length
      ? [{ resources: unknown, badge: 'REQUESTED' as const }]
      : []),
  ]
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
