import { getDb } from '@/lib/drizzle/client'
import { mcpAuditLogs } from '@/lib/drizzle/schema'
import { eq, desc, sql } from 'drizzle-orm'
import crypto from 'crypto'
import type { AuditEntry } from './types'

export async function logAudit(entry: AuditEntry): Promise<void> {
  const db = await getDb()
  await db.insert(mcpAuditLogs).values({
    id: crypto.randomUUID(),
    userId: entry.userId,
    authType: entry.authType,
    keyId: entry.keyId ?? null,
    action: entry.action,
    resourceType: entry.resourceType ?? null,
    resourceId: entry.resourceId ?? null,
    ipAddress: entry.ipAddress ?? null,
    userAgent: entry.userAgent ?? null,
    success: entry.success,
    errorMessage: entry.errorMessage ?? null,
  })
}

export async function getAuditLogs(
  userId: string,
  limit: number = 50,
  offset: number = 0,
) {
  const db = await getDb()
  return db
    .select()
    .from(mcpAuditLogs)
    .where(eq(mcpAuditLogs.userId, userId))
    .orderBy(desc(mcpAuditLogs.createdAt))
    .limit(limit)
    .offset(offset)
}

export async function getAuditLogsCount(userId: string): Promise<number> {
  const db = await getDb()
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mcpAuditLogs)
    .where(eq(mcpAuditLogs.userId, userId))
  return row?.count ?? 0
}
