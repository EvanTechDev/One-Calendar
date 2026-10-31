import { getDb } from '@/lib/drizzle/client'
import { mcpAuditLogs } from '@/lib/drizzle/schema'
import { eq, and, gte, sql } from 'drizzle-orm'
import { getMcpSettings } from './settings'

/**
 * Per-user requests-per-minute budget, counted from the MCP audit log.
 *
 * The counter is the audit table itself rather than a separate store: the
 * request that counts is the same row the audit trail requires, so the budget
 * costs no extra write and no extra state that can disagree with the log.
 * This used to prefer Redis, but the Redis branch was unreachable in practice
 * (the configured instance's TLS port timed out) and a Redis outage blocked
 * for ioredis' full connect timeout before falling through to this path.
 *
 * The count trails by one request, since the current request is not written
 * until after it is admitted — which is why the comparison below is `count <
 * maxRpm` and not `count <= maxRpm`.
 */
export async function checkRateLimit(userId: string): Promise<{
  allowed: boolean
  remaining: number
  resetAt: number
}> {
  const settings = await getMcpSettings(userId)
  const maxRpm = settings.rateLimitRpm
  const now = Date.now()
  const resetAt = Math.ceil(now / 60_000) * 60_000

  const [row] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(mcpAuditLogs)
    .where(
      and(
        eq(mcpAuditLogs.userId, userId),
        gte(mcpAuditLogs.createdAt, new Date(now - 60_000)),
        // Count REQUESTS only. Since audit logging became per-tool-call, a
        // single batched request writes N extra rows; counting those would
        // charge one request N times against the RPM budget.
        eq(mcpAuditLogs.entryType, 'request'),
      ),
    )

  const count = row?.count ?? 0

  return {
    // `count` is what has ALREADY been admitted, and this call is about to admit
    // one more, so the budget is spent once `count` reaches the limit — not when
    // it exceeds it. Comparing `count <= maxRpm` would let request number
    // `maxRpm + 1` through.
    allowed: count < maxRpm,
    remaining: Math.max(0, maxRpm - count - 1),
    resetAt,
  }
}
