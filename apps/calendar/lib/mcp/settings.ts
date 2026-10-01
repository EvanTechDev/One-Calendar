import { getDb } from '@/lib/drizzle/client'
import { mcpSettings } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'

/**
 * Bounds for the account-wide MCP throttle.
 *
 * The limiter computes `allowed: count <= maxRpm` directly, so an unclamped
 * value is a self-inflicted lockout at one end and no throttle at all at the
 * other — on the endpoint that can run a multi-step agent tool loop. Clamped
 * here rather than at the route so both callers and any future one get it.
 */
const MIN_RATE_LIMIT_RPM = 1
const MAX_RATE_LIMIT_RPM = 600
const DEFAULT_RATE_LIMIT_RPM = 60

function clampRateLimitRpm(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_RATE_LIMIT_RPM
  }
  return Math.min(
    MAX_RATE_LIMIT_RPM,
    Math.max(MIN_RATE_LIMIT_RPM, Math.trunc(value)),
  )
}

export async function getMcpSettings(userId: string) {
  const db = await getDb()
  const [row] = await db
    .select()
    .from(mcpSettings)
    .where(eq(mcpSettings.userId, userId))

  return (
    row ?? {
      userId,
      enabled: true,
      rateLimitRpm: DEFAULT_RATE_LIMIT_RPM,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  )
}

export async function updateMcpSettings(
  userId: string,
  data: { enabled?: boolean; rateLimitRpm?: number },
) {
  const db = await getDb()
  const rateLimitRpm =
    data.rateLimitRpm === undefined
      ? DEFAULT_RATE_LIMIT_RPM
      : clampRateLimitRpm(data.rateLimitRpm)
  const [row] = await db
    .insert(mcpSettings)
    .values({
      userId,
      enabled: data.enabled ?? true,
      rateLimitRpm,
    })
    .onConflictDoUpdate({
      target: mcpSettings.userId,
      set: {
        enabled: data.enabled ?? undefined,
        rateLimitRpm:
          data.rateLimitRpm === undefined ? undefined : rateLimitRpm,
        updatedAt: new Date(),
      },
    })
    .returning()

  return row
}
