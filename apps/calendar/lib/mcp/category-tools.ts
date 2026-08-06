import { getDb } from '@/lib/drizzle/client'
import { calendarCategories } from '@/lib/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { encryptField, decryptField } from '@/lib/field-crypto'
import crypto from 'crypto'

export const CATEGORY_COLORS = [
  { name: 'blue', value: 'bg-blue-500' },
  { name: 'green', value: 'bg-green-500' },
  { name: 'yellow', value: 'bg-yellow-500' },
  { name: 'red', value: 'bg-red-500' },
  { name: 'purple', value: 'bg-purple-500' },
  { name: 'pink', value: 'bg-pink-500' },
  { name: 'teal', value: 'bg-teal-500' },
] as const

export const CATEGORY_COLOR_VALUES = CATEGORY_COLORS.map((c) => c.value)

function normalizeCategoryColor(color: string): string {
  if (!color) return 'bg-blue-500'
  const trimmed = color.trim()
  const byName = CATEGORY_COLORS.find((c) => c.name === trimmed)
  if (byName) return byName.value
  const byValue = CATEGORY_COLORS.find((c) => c.value === trimmed)
  if (byValue) return byValue.value
  return 'bg-blue-500'
}

export async function listCategories(userId: string) {
  const db = await getDb()
  const rows = await db
    .select()
    .from(calendarCategories)
    .where(eq(calendarCategories.userId, userId))
    .orderBy(calendarCategories.sortOrder)

  return rows.map((cat) => ({
    ...cat,
    name: decryptField(cat.id, cat.name) ?? cat.name,
  }))
}

export async function createCategory(
  userId: string,
  data: { name: string; color: string; sort_order?: number },
) {
  const id = crypto.randomUUID()
  const db = await getDb()

  const [row] = await db
    .insert(calendarCategories)
    .values({
      id,
      userId,
      name: encryptField(id, data.name) ?? data.name,
      color: normalizeCategoryColor(data.color),
      sortOrder: data.sort_order ?? 0,
    })
    .returning()

  return {
    ...row,
    name: decryptField(row.id, row.name) ?? row.name,
  }
}

export async function updateCategory(
  userId: string,
  categoryId: string,
  data: { name?: string; color?: string; sort_order?: number },
) {
  const db = await getDb()

  const values: Record<string, unknown> = {}
  if (data.name !== undefined)
    values.name = encryptField(categoryId, data.name) ?? data.name
  if (data.color !== undefined && data.color !== null)
    values.color = normalizeCategoryColor(data.color)
  if (data.sort_order !== undefined) values.sortOrder = data.sort_order

  const [row] = await db
    .update(calendarCategories)
    .set(values)
    .where(
      and(
        eq(calendarCategories.id, categoryId),
        eq(calendarCategories.userId, userId),
      ),
    )
    .returning()

  if (!row) return null
  return {
    ...row,
    name: decryptField(row.id, row.name) ?? row.name,
  }
}

export async function deleteCategory(
  userId: string,
  categoryId: string,
): Promise<void> {
  const db = await getDb()
  await db
    .delete(calendarCategories)
    .where(
      and(
        eq(calendarCategories.id, categoryId),
        eq(calendarCategories.userId, userId),
      ),
    )
}
