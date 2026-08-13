import { getDb } from '@/lib/drizzle/client'
import { mcpAuditLogs } from '@/lib/drizzle/schema'
import { eq, and, gte, sql } from 'drizzle-orm'
import { getMcpSettings } from './settings'
import { withRedis } from '@/lib/cache/client'

export async function checkRateLimit(userId: string): Promise<{
  allowed: boolean
  remaining: number
  resetAt: number
}> {
  const settings = await getMcpSettings(userId)
  const maxRpm = settings.rateLimitRpm
  const now = Date.now()
  const resetAt = Math.ceil(now / 60_000) * 60_000

  const bucket = Math.floor(now / 60_000)
  const key = `mcp:rl:${userId}:${bucket}`

  const redisCount = await withRedis<number | null>(
    async (redis) => {
      const count = await redis.incr(key)
      if (count === 1) await redis.expire(key, 120)
      return count
    },
    async () => null,
  )

  let count = redisCount
  if (count === null) {
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

    count = row?.count ?? 0
  }

  return {
    allowed: count <= maxRpm,
    remaining: Math.max(0, maxRpm - count),
    resetAt,
  }
}