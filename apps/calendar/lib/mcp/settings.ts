import { getDb } from '@/lib/drizzle/client'
import { mcpSettings } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'

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
      rateLimitRpm: 60,
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
  const [row] = await db
    .insert(mcpSettings)
    .values({
      userId,
      enabled: data.enabled ?? true,
      rateLimitRpm: data.rateLimitRpm ?? 60,
    })
    .onConflictDoUpdate({
      target: mcpSettings.userId,
      set: {
        enabled: data.enabled ?? undefined,
        rateLimitRpm: data.rateLimitRpm ?? undefined,
        updatedAt: new Date(),
      },
    })
    .returning()

  return row
}
