import { getDb } from '@/lib/drizzle/client'
import { countdowns } from '@/lib/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { encryptField } from '@/lib/field-crypto'
import crypto from 'crypto'

export async function listCountdowns(userId: string) {
  const db = await getDb()
  const rows = await db
    .select()
    .from(countdowns)
    .where(eq(countdowns.userId, userId))

  return rows.map((c) => ({
    ...c,
    name: c.name,
  }))
}

export async function createCountdown(
  userId: string,
  data: {
    name: string
    target_date: string
    description?: string | null
    color?: string | null
    icon?: string | null
  },
) {
  const id = crypto.randomUUID()
  const db = await getDb()

  const [row] = await db
    .insert(countdowns)
    .values({
      id,
      userId,
      name: encryptField(id, data.name) ?? data.name,
      targetDate: new Date(data.target_date),
      description: data.description ? encryptField(id, data.description) : null,
      color: data.color ?? null,
      icon: data.icon ?? null,
    })
    .returning()

  return row
}

export async function updateCountdown(
  userId: string,
  countdownId: string,
  data: {
    name?: string
    target_date?: string
    description?: string | null
    color?: string | null
    icon?: string | null
  },
) {
  const db = await getDb()

  const values: Record<string, unknown> = {}
  if (data.name !== undefined)
    values.name = encryptField(countdownId, data.name) ?? data.name
  if (data.target_date !== undefined)
    values.targetDate = new Date(data.target_date)
  if (data.description !== undefined)
    values.description = encryptField(countdownId, data.description)
  if (data.color !== undefined) values.color = data.color
  if (data.icon !== undefined) values.icon = data.icon

  const [row] = await db
    .update(countdowns)
    .set(values)
    .where(and(eq(countdowns.id, countdownId), eq(countdowns.userId, userId)))
    .returning()

  return row ?? null
}

export async function deleteCountdown(
  userId: string,
  countdownId: string,
): Promise<void> {
  const db = await getDb()
  await db
    .delete(countdowns)
    .where(and(eq(countdowns.id, countdownId), eq(countdowns.userId, userId)))
}
