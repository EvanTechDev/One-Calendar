import { NextRequest, NextResponse } from 'next/server'
import { withEvlog, useLogger, getAuditActor } from '@/lib/evlog'
import { getServerSession } from '@/lib/auth/server'
import { db } from '@/lib/drizzle/client'
import {
  calendarBackups,
  calendarBookmarks,
  calendarCategories,
  calendarCountdowns,
  userSettings,
} from '@/lib/drizzle/schema'
import { and, eq, gte, lte, or } from 'drizzle-orm'
import { decryptServerJson, encryptServerJson } from '@/lib/server-crypto'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
}

type CalendarEventPayload = {
  id?: string
  title?: string
  startDate?: string | Date
  endDate?: string | Date
  isAllDay?: boolean
  recurrence?: string
  location?: string
  participants?: string[]
  notification?: number
  description?: string
  color?: string
  calendarId?: string
  [key: string]: unknown
}

type CalendarCategoryPayload = {
  id?: string
  name?: string
  color?: string
  keywords?: string[]
  position?: number
  [key: string]: unknown
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...NO_STORE_HEADERS, ...init?.headers },
  })
}

function id(prefix: string) {
  return `${prefix}_${randomUUID()}`
}

function asDate(value: unknown, fallback = new Date()) {
  const date = value ? new Date(value as string | Date) : fallback
  if (Number.isNaN(date.getTime())) return fallback
  return date
}

function eventContext(userId: string, eventId: string) {
  return `calendar-event:${userId}:${eventId}`
}

function categoryContext(userId: string, categoryId: string) {
  return `calendar-category:${userId}:${categoryId}`
}

function bookmarkContext(userId: string, bookmarkId: string) {
  return `calendar-bookmark:${userId}:${bookmarkId}`
}

function countdownContext(userId: string, countdownId: string) {
  return `calendar-countdown:${userId}:${countdownId}`
}

function serializeEvent(row: typeof calendarBackups.$inferSelect) {
  const extra = decryptServerJson<Record<string, unknown>>(
    row.encryptedData,
    row.iv,
    row.authTag,
    eventContext(row.userId, row.id),
    {},
  )
  return {
    ...extra,
    id: row.id,
    title: row.title,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    isAllDay: row.isAllDay,
    recurrence: row.recurrence,
    color: row.color,
    calendarId: row.calendarId ?? '',
  }
}

function serializeCategory(row: typeof calendarCategories.$inferSelect) {
  const extra = decryptServerJson<Record<string, unknown>>(
    row.encryptedData,
    row.iv,
    row.authTag,
    categoryContext(row.userId, row.id),
    {},
  )
  return {
    ...extra,
    id: row.id,
    name: row.name,
    color: row.color,
    keywords: row.keywords,
    position: row.position,
  }
}

function eventValues(userId: string, input: CalendarEventPayload) {
  const eventId = input.id || id('evt')
  const startDate = asDate(input.startDate)
  const endDate = asDate(input.endDate, startDate)
  const title = typeof input.title === 'string' ? input.title : 'Untitled event'
  const calendarId =
    typeof input.calendarId === 'string' && input.calendarId
      ? input.calendarId
      : null
  const extra = {
    description: input.description ?? '',
    location: input.location ?? '',
    participants: Array.isArray(input.participants) ? input.participants : [],
    notification:
      typeof input.notification === 'number' ? input.notification : 0,
    extensions: Object.fromEntries(
      Object.entries(input).filter(
        ([key]) =>
          ![
            'id',
            'title',
            'startDate',
            'endDate',
            'isAllDay',
            'recurrence',
            'calendarId',
            'color',
          ].includes(key),
      ),
    ),
  }
  const encrypted = encryptServerJson(extra, eventContext(userId, eventId))
  const now = new Date()
  return {
    id: eventId,
    userId,
    title,
    startDate,
    endDate,
    isAllDay: Boolean(input.isAllDay),
    recurrence:
      typeof input.recurrence === 'string' ? input.recurrence : 'none',
    calendarId,
    color:
      typeof input.color === 'string' && input.color ? input.color : '#3b82f6',
    searchableText: [title, input.description, input.location]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
    ...encrypted,
    createdAt: now,
    updatedAt: now,
  }
}

export const GET = withEvlog(async function GET(req: NextRequest) {
  try {
    const log = useLogger()
    const session = await getServerSession()
    const user = session?.user
    const userId = user?.id

    if (!userId) {
      return jsonNoStore({ error: 'Unauthorized' }, { status: 401 })
    }

    const start = req.nextUrl.searchParams.get('start')
    const end = req.nextUrl.searchParams.get('end')
    const where =
      start && end
        ? and(
            eq(calendarBackups.userId, userId),
            or(
              and(
                gte(calendarBackups.startDate, asDate(start)),
                lte(calendarBackups.startDate, asDate(end)),
              ),
              and(
                gte(calendarBackups.endDate, asDate(start)),
                lte(calendarBackups.endDate, asDate(end)),
              ),
            ),
          )
        : eq(calendarBackups.userId, userId)

    const [events, categories, settings, bookmarks, countdowns] =
      await Promise.all([
        db.select().from(calendarBackups).where(where),
        db
          .select()
          .from(calendarCategories)
          .where(eq(calendarCategories.userId, userId)),
        db.select().from(userSettings).where(eq(userSettings.userId, userId)),
        db
          .select()
          .from(calendarBookmarks)
          .where(eq(calendarBookmarks.userId, userId)),
        db
          .select()
          .from(calendarCountdowns)
          .where(eq(calendarCountdowns.userId, userId)),
      ])

    log.audit?.({
      action: 'calendar_data.range_export',
      actor: getAuditActor(log, {
        type: 'user',
        id: userId,
        ...(user?.email ? { email: user.email } : {}),
      }),
      target: { type: 'calendar_data', id: userId },
      outcome: 'success',
      reason:
        start && end
          ? 'User loaded calendar data by range'
          : 'User exported calendar data',
    })

    return jsonNoStore({
      events: events.map(serializeEvent),
      categories: categories.map(serializeCategory),
      settings: settings[0]?.settings ?? {},
      bookmarks: bookmarks.map((row) => ({
        ...decryptServerJson(
          row.encryptedData,
          row.iv,
          row.authTag,
          bookmarkContext(row.userId, row.id),
          {},
        ),
        id: row.id,
        eventId: row.eventId,
        title: row.title,
        startDate: row.startDate.toISOString(),
        endDate: row.endDate.toISOString(),
        color: row.color,
      })),
      countdowns: countdowns.map((row) => ({
        ...decryptServerJson(
          row.encryptedData,
          row.iv,
          row.authTag,
          countdownContext(row.userId, row.id),
          {},
        ),
        id: row.id,
        title: row.title,
        dueDate: row.dueDate.toISOString(),
        eventId: row.eventId ?? '',
      })),
      backend: 'postgres',
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error'
    return jsonNoStore({ error: message }, { status: 500 })
  }
})

export const POST = withEvlog(async function POST(req: NextRequest) {
  try {
    const log = useLogger()
    const [session, body] = await Promise.all([getServerSession(), req.json()])
    const user = session?.user
    const userId = user?.id

    if (!userId)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const events = Array.isArray(body?.events)
      ? body.events
      : body?.event
        ? [body.event]
        : body?.ciphertext
          ? []
          : []
    const categories = Array.isArray(body?.categories) ? body.categories : []
    const now = new Date()

    await db.transaction(async (tx) => {
      for (const event of events as CalendarEventPayload[]) {
        const values = eventValues(userId, event)
        const [existing] = await tx
          .select({ userId: calendarBackups.userId })
          .from(calendarBackups)
          .where(eq(calendarBackups.id, values.id))
        if (existing && existing.userId !== userId)
          throw new Error('Event ID already exists')
        await tx
          .insert(calendarBackups)
          .values(values)
          .onConflictDoUpdate({
            target: calendarBackups.id,
            set: {
              userId: values.userId,
              title: values.title,
              startDate: values.startDate,
              endDate: values.endDate,
              isAllDay: values.isAllDay,
              recurrence: values.recurrence,
              calendarId: values.calendarId,
              color: values.color,
              searchableText: values.searchableText,
              encryptedData: values.encryptedData,
              iv: values.iv,
              authTag: values.authTag,
              updatedAt: now,
            },
          })
      }

      for (const category of categories as CalendarCategoryPayload[]) {
        const categoryId = category.id || id('cat')
        const encrypted = encryptServerJson(
          { extensions: category },
          categoryContext(userId, categoryId),
        )
        const values = {
          id: categoryId,
          userId,
          name: typeof category.name === 'string' ? category.name : 'Untitled',
          color:
            typeof category.color === 'string' ? category.color : '#3b82f6',
          keywords: Array.isArray(category.keywords) ? category.keywords : [],
          position:
            typeof category.position === 'number' ? category.position : 0,
          ...encrypted,
          createdAt: now,
          updatedAt: now,
        }
        const [existing] = await tx
          .select({ userId: calendarCategories.userId })
          .from(calendarCategories)
          .where(eq(calendarCategories.id, values.id))
        if (existing && existing.userId !== userId)
          throw new Error('Category ID already exists')
        await tx
          .insert(calendarCategories)
          .values(values)
          .onConflictDoUpdate({
            target: calendarCategories.id,
            set: {
              userId: values.userId,
              name: values.name,
              color: values.color,
              keywords: values.keywords,
              position: values.position,
              encryptedData: values.encryptedData,
              iv: values.iv,
              authTag: values.authTag,
              updatedAt: now,
            },
          })
      }

      if (body?.settings && typeof body.settings === 'object') {
        await tx
          .insert(userSettings)
          .values({
            userId,
            settings: body.settings,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: userSettings.userId,
            set: { settings: body.settings, updatedAt: now },
          })
      }
    })

    log.audit?.({
      action: 'calendar_data.upsert',
      actor: getAuditActor(log, {
        type: 'user',
        id: userId,
        ...(user?.email ? { email: user.email } : {}),
      }),
      target: { type: 'calendar_data', id: userId },
      outcome: 'success',
      reason: 'User saved event-level calendar data',
    })
    return NextResponse.json({ success: true, backend: 'postgres' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

export const DELETE = withEvlog(async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession()
    const userId = session?.user?.id
    if (!userId)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    if (typeof body?.eventId === 'string') {
      await db
        .delete(calendarBackups)
        .where(
          and(
            eq(calendarBackups.userId, userId),
            eq(calendarBackups.id, body.eventId),
          ),
        )
      await db
        .delete(calendarBookmarks)
        .where(
          and(
            eq(calendarBookmarks.userId, userId),
            eq(calendarBookmarks.eventId, body.eventId),
          ),
        )
    } else if (typeof body?.categoryId === 'string') {
      await db.transaction(async (tx) => {
        await tx
          .delete(calendarCategories)
          .where(
            and(
              eq(calendarCategories.userId, userId),
              eq(calendarCategories.id, body.categoryId),
            ),
          )
        await tx
          .update(calendarBackups)
          .set({ calendarId: null, updatedAt: new Date() })
          .where(
            and(
              eq(calendarBackups.userId, userId),
              eq(calendarBackups.calendarId, body.categoryId),
            ),
          )
      })
    } else {
      await db.transaction(async (tx) => {
        await tx
          .delete(calendarBackups)
          .where(eq(calendarBackups.userId, userId))
        await tx
          .delete(calendarCategories)
          .where(eq(calendarCategories.userId, userId))
        await tx
          .delete(calendarBookmarks)
          .where(eq(calendarBookmarks.userId, userId))
        await tx
          .delete(calendarCountdowns)
          .where(eq(calendarCountdowns.userId, userId))
        await tx.delete(userSettings).where(eq(userSettings.userId, userId))
      })
    }

    return NextResponse.json({ success: true, backend: 'postgres' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
