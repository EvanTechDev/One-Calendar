import { getDb } from '@/lib/drizzle/client'
import { calendarEvents } from '@/lib/drizzle/schema'
import { eq, and, gte, lte, ilike, or, desc, sql } from 'drizzle-orm'
import { encryptField } from '@/lib/field-crypto'
import { decryptEvent } from '@/lib/api-helpers'
import crypto from 'crypto'

export async function listEvents(
  userId: string,
  startDate?: string,
  endDate?: string,
  query?: string,
  page: number = 1,
  limit: number = 50,
) {
  const db = await getDb()
  const filters = [eq(calendarEvents.userId, userId)]

  if (startDate && endDate) {
    filters.push(gte(calendarEvents.startDate, new Date(startDate)))
    filters.push(lte(calendarEvents.endDate, new Date(endDate)))
  }

  if (query) {
    const pattern = `%${query}%`
    filters.push(
      or(
        ilike(calendarEvents.title, pattern),
        ilike(calendarEvents.description, pattern),
        ilike(calendarEvents.location, pattern),
      ),
    )
  }

  const offset = (page - 1) * limit

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(calendarEvents)
      .where(and(...filters))
      .orderBy(desc(calendarEvents.startDate))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(calendarEvents)
      .where(and(...filters)),
  ])

  const events = rows.map(decryptEvent)
  const total = countResult[0]?.count ?? 0

  return {
    events,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export async function getEvent(userId: string, eventId: string) {
  const db = await getDb()
  const [row] = await db
    .select()
    .from(calendarEvents)
    .where(
      and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)),
    )

  if (!row) return null
  return decryptEvent(row)
}

export async function createEvent(
  userId: string,
  data: {
    title: string
    description?: string | null
    location?: string | null
    start_date: string
    end_date: string
    is_all_day?: boolean
    color: string
    category_id?: string | null
    notification_minutes?: number | null
  },
) {
  const id = crypto.randomUUID()
  const db = await getDb()

  const [event] = await db
    .insert(calendarEvents)
    .values({
      id,
      userId,
      title: encryptField(id, data.title) ?? '',
      description: encryptField(id, data.description),
      location: encryptField(id, data.location),
      startDate: new Date(data.start_date),
      endDate: new Date(data.end_date),
      isAllDay: data.is_all_day ?? false,
      color: data.color,
      categoryId: data.category_id ?? null,
      notificationMinutes: data.notification_minutes ?? null,
    })
    .returning()

  return decryptEvent(event)
}

export async function updateEvent(
  userId: string,
  eventId: string,
  data: {
    title?: string
    description?: string | null
    location?: string | null
    start_date?: string
    end_date?: string
    is_all_day?: boolean
    color?: string | null
    category_id?: string | null
    notification_minutes?: number | null
  },
) {
  const db = await getDb()
  const existing = await getEvent(userId, eventId)
  if (!existing) return null

  const values: Record<string, unknown> = {}
  if (data.title !== undefined)
    values.title = encryptField(eventId, data.title) ?? ''
  if (data.description !== undefined)
    values.description = encryptField(eventId, data.description)
  if (data.location !== undefined)
    values.location = encryptField(eventId, data.location)
  if (data.start_date !== undefined)
    values.startDate = new Date(data.start_date)
  if (data.end_date !== undefined) values.endDate = new Date(data.end_date)
  if (data.is_all_day !== undefined) values.isAllDay = data.is_all_day
  if (data.color !== undefined) values.color = data.color
  if (data.category_id !== undefined) values.categoryId = data.category_id
  if (data.notification_minutes !== undefined)
    values.notificationMinutes = data.notification_minutes
  values.updatedAt = new Date()

  const [event] = await db
    .update(calendarEvents)
    .set(values)
    .where(
      and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)),
    )
    .returning()

  return decryptEvent(event)
}

export async function deleteEvent(
  userId: string,
  eventId: string,
): Promise<void> {
  const db = await getDb()
  await db
    .delete(calendarEvents)
    .where(
      and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)),
    )
}
