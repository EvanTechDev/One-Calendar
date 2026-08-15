import { getDb } from '@/lib/drizzle/client'
import { countdowns } from '@/lib/drizzle/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { encryptField, decryptField } from '@/lib/field-crypto'
import { normalizeCountdownColor } from './colors'
import crypto from 'crypto'

export async function listCountdowns(
  userId: string,
  page: number = 1,
  limit: number = 50,
) {
  const db = await getDb()
  const offset = (page - 1) * limit

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(countdowns)
      .where(eq(countdowns.userId, userId))
      .orderBy(desc(countdowns.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(countdowns)
      .where(eq(countdowns.userId, userId)),
  ])

  const items = rows.map((c) => ({
    ...c,
    name: decryptField(c.id, c.name) ?? c.name,
    description: decryptField(c.id, c.description),
    color: c.color ? normalizeCountdownColor(c.color) : c.color,
  }))
  const total = countResult[0]?.count ?? 0

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export async function createCountdown(
  userId: string,
  data: {
    name: string
    target_date: string
    description?: string | null
    color: string
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
      color: normalizeCountdownColor(data.color),
      icon: data.icon ?? null,
    })
    .returning()

  return {
    ...row,
    name: decryptField(row.id, row.name) ?? row.name,
    description: decryptField(row.id, row.description),
  }
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
  if (data.color !== undefined && data.color !== null)
    values.color = normalizeCountdownColor(data.color)
  if (data.icon !== undefined) values.icon = data.icon

  const [row] = await db
    .update(countdowns)
    .set(values)
    .where(and(eq(countdowns.id, countdownId), eq(countdowns.userId, userId)))
    .returning()

  if (!row) return null
  return {
    ...row,
    name: decryptField(row.id, row.name) ?? row.name,
    description: decryptField(row.id, row.description),
  }
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
