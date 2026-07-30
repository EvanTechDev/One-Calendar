import { getDb } from '@/lib/drizzle/client'
import { mcpAuditLogs } from '@/lib/drizzle/schema'
import { eq, and, gte, sql } from 'drizzle-orm'
import { getMcpSettings } from './settings'

export async function checkRateLimit(userId: string): Promise<{
  allowed: boolean
  remaining: number
  resetAt: number
}> {
  const settings = await getMcpSettings(userId)
  const maxRpm = settings.rateLimitRpm
  const now = Date.now()
  const windowStart = new Date(now - 60_000)

  const db = await getDb()
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mcpAuditLogs)
    .where(
      and(
        eq(mcpAuditLogs.userId, userId),
        gte(mcpAuditLogs.createdAt, windowStart),
      ),
    )

  const count = row?.count ?? 0
  const resetAt = Math.ceil(now / 60_000) * 60_000

  if (count >= maxRpm) {
    return { allowed: false, remaining: 0, resetAt }
  }

  return { allowed: true, remaining: maxRpm - count - 1, resetAt }
}
