import { getDb } from '@/lib/drizzle/client'
import { mcpAuditLogs } from '@/lib/drizzle/schema'
import {
  eq,
  desc,
  sql,
  lt,
  gte,
  and,
  or,
  ilike,
  isNotNull,
  type SQL,
} from 'drizzle-orm'
import crypto from 'crypto'
import type { AuditEntry, AuditEntryType } from './types'

export async function logAudit(entry: AuditEntry): Promise<void> {
  const db = await getDb()
  await db.insert(mcpAuditLogs).values({
    id: crypto.randomUUID(),
    userId: entry.userId,
    authType: entry.authType,
    keyId: entry.keyId ?? null,
    action: entry.action,
    entryType: entry.entryType ?? 'request',
    toolName: entry.toolName ?? null,
    resourceType: entry.resourceType ?? null,
    resourceId: entry.resourceId ?? null,
    isMutation: entry.isMutation ?? false,
    changes: entry.changes ?? null,
    durationMs: entry.durationMs ?? null,
    ipAddress: entry.ipAddress ?? null,
    userAgent: entry.userAgent ?? null,
    success: entry.success,
    errorMessage: entry.errorMessage ?? null,
  })
}

/**
 * Audit log filters. All are optional and AND-ed; omitting them returns every
 * row for the user (the previous behaviour).
 */
export interface AuditLogFilters {
  entryType?: AuditEntryType
  /** Only rows that changed data. */
  mutationsOnly?: boolean
  /** Only failures. */
  failuresOnly?: boolean
  toolName?: string
  /** Only rows created at or after this instant. */
  since?: Date
  /**
   * Case-insensitive substring match over tool name, action, resource type,
   * resource id and error message.
   */
  search?: string
}

/** Escapes LIKE wildcards so a user-typed `%` matches a literal `%`. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

function auditFilterConditions(userId: string, filters: AuditLogFilters = {}) {
  const conditions: SQL[] = [eq(mcpAuditLogs.userId, userId)]
  if (filters.entryType) {
    conditions.push(eq(mcpAuditLogs.entryType, filters.entryType))
  }
  if (filters.mutationsOnly) {
    conditions.push(eq(mcpAuditLogs.isMutation, true))
  }
  if (filters.failuresOnly) {
    conditions.push(eq(mcpAuditLogs.success, false))
  }
  if (filters.toolName) {
    conditions.push(eq(mcpAuditLogs.toolName, filters.toolName))
  }
  if (filters.since) {
    conditions.push(gte(mcpAuditLogs.createdAt, filters.since))
  }
  if (filters.search) {
    const needle = `%${escapeLike(filters.search)}%`
    const searchCondition = or(
      ilike(mcpAuditLogs.toolName, needle),
      ilike(mcpAuditLogs.action, needle),
      ilike(mcpAuditLogs.resourceType, needle),
      ilike(mcpAuditLogs.resourceId, needle),
      ilike(mcpAuditLogs.errorMessage, needle),
    )
    if (searchCondition) conditions.push(searchCondition)
  }
  return and(...conditions)
}

export async function getAuditLogs(
  userId: string,
  limit: number = 50,
  offset: number = 0,
  filters: AuditLogFilters = {},
) {
  const db = await getDb()
  return db
    .select()
    .from(mcpAuditLogs)
    .where(auditFilterConditions(userId, filters))
    .orderBy(desc(mcpAuditLogs.createdAt))
    .limit(limit)
    .offset(offset)
}

export async function getAuditLogsCount(
  userId: string,
  filters: AuditLogFilters = {},
): Promise<number> {
  const db = await getDb()
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mcpAuditLogs)
    .where(auditFilterConditions(userId, filters))
  return row?.count ?? 0
}

/** Distinct tool names this user has actually invoked, for the filter UI. */
export async function getAuditToolNames(userId: string): Promise<string[]> {
  const db = await getDb()
  const rows = await db
    .selectDistinct({ toolName: mcpAuditLogs.toolName })
    .from(mcpAuditLogs)
    .where(
      and(eq(mcpAuditLogs.userId, userId), isNotNull(mcpAuditLogs.toolName)),
    )
  return rows
    .map((r) => r.toolName)
    .filter((n): n is string => typeof n === 'string')
    .sort()
}

const DEFAULT_RETENTION_DAYS = 30

export async function cleanupAuditLogs(
  retentionDays: number = DEFAULT_RETENTION_DAYS,
): Promise<number> {
  const db = await getDb()
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const result = await db
    .delete(mcpAuditLogs)
    .where(lt(mcpAuditLogs.createdAt, cutoff))
    .returning({ id: mcpAuditLogs.id })
  return result.length
}
