import { getDb } from '@/lib/drizzle/client'
import { settings } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'

export async function getSettings(userId: string) {
  const db = await getDb()
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.userId, userId))

  return row?.data ?? {}
}

export async function updateSettings(
  userId: string,
  data: Record<string, unknown>,
) {
  const db = await getDb()
  const [existing] = await db
    .select()
    .from(settings)
    .where(eq(settings.userId, userId))

  const existingData = existing?.data as Record<string, unknown> | undefined
  const merged = { ...existingData, ...data }

  await db
    .insert(settings)
    .values({
      userId,
      data: merged,
    })
    .onConflictDoUpdate({
      target: settings.userId,
      set: {
        data: merged,
        updatedAt: new Date(),
      },
    })
}
