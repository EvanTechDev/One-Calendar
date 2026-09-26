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
import { parseRetentionDays } from './cleanup-config'
import type { AuditEntry, AuditEntryType } from './types'

export async function logAudit(entry: AuditEntry): Promise<void> {
  const db = await getDb()
  scheduleRetentionPrune()
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

/** Retention window for the opportunistic prune, from the environment. */
function retentionWindowDays(): number {
  return parseRetentionDays(
    process.env.MCP_AUDIT_RETENTION_DAYS ?? null,
    DEFAULT_RETENTION_DAYS,
  )
}

export async function cleanupAuditLogs(
  retentionDays: number = retentionWindowDays(),
): Promise<number> {
  const db = await getDb()
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const result = await db
    .delete(mcpAuditLogs)
    .where(lt(mcpAuditLogs.createdAt, cutoff))
    .returning({ id: mcpAuditLogs.id })
  return result.length
}

/**
 * How often one process may prune, and the in-flight guard.
 *
 * Every MCP call writes at least one row, so a prune on every write would put
 * a `DELETE` on the hot path of every request. Six hours is well inside the
 * retention window's own resolution: the oldest surviving row can only be a
 * few hours older than the window, never unbounded.
 */
const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000
let lastPruneAt = 0
let pruneInFlight: Promise<unknown> | null = null

/**
 * Prune from the write path, because the cron cannot be relied on to do it.
 *
 * Retention is also enforced by the daily maintenance run, `/api/blob/check`,
 * but that route needs `CRON_SECRET` to be set in the deployment — and with the
 * secret unset the table only ever grows. It did: rows older than the window
 * were still there months after the retention landed. A cron that depends on a
 * secret nobody remembered to set is not a retention policy, so the busiest
 * writer in the system also trims, and the cron stays as the backstop for
 * installs with no MCP traffic.
 *
 * Best effort by construction: not awaited, so a slow or failing prune cannot
 * delay the log write it rode along with, and a rejection is swallowed.
 */
function scheduleRetentionPrune(): void {
  if (pruneInFlight) return
  if (Date.now() - lastPruneAt < PRUNE_INTERVAL_MS) return
  lastPruneAt = Date.now()
  pruneInFlight = cleanupAuditLogs()
    .catch(() => 0)
    .finally(() => {
      pruneInFlight = null
    })
}
