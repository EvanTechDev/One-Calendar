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
import { and, eq } from 'drizzle-orm'
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

type CalendarBookmarkPayload = {
  id?: string
  eventId?: string
  title?: string
  startDate?: string | Date
  endDate?: string | Date
  color?: string
  [key: string]: unknown
}

type CalendarCountdownPayload = {
  id?: string
  title?: string
  name?: string
  dueDate?: string | Date
  date?: string | Date
  eventId?: string
  [key: string]: unknown
}

type EncryptedSettingsEnvelope = {
  encryptedData?: string
  iv?: string
  authTag?: string
}

const ENCRYPTED_TEXT_PLACEHOLDER = '[encrypted]'
const ENCRYPTED_DATE_PLACEHOLDER = new Date(0)

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

function settingsContext(userId: string) {
  return `user-settings:${userId}`
}

function serializeEvent(row: typeof calendarBackups.$inferSelect) {
  const decrypted = decryptServerJson<Record<string, unknown>>(
    row.encryptedData,
    row.iv,
    row.authTag,
    eventContext(row.userId, row.id),
    {},
  )
  const legacyExtensions =
    decrypted.extensions && typeof decrypted.extensions === 'object'
      ? (decrypted.extensions as Record<string, unknown>)
      : {}
  return {
    ...legacyExtensions,
    ...decrypted,
    id: row.id,
    title: typeof decrypted.title === 'string' ? decrypted.title : row.title,
    startDate:
      typeof decrypted.startDate === 'string'
        ? decrypted.startDate
        : row.startDate.toISOString(),
    endDate:
      typeof decrypted.endDate === 'string'
        ? decrypted.endDate
        : row.endDate.toISOString(),
    isAllDay:
      typeof decrypted.isAllDay === 'boolean'
        ? decrypted.isAllDay
        : row.isAllDay,
    recurrence:
      typeof decrypted.recurrence === 'string'
        ? decrypted.recurrence
        : row.recurrence,
    color: typeof decrypted.color === 'string' ? decrypted.color : row.color,
    calendarId:
      typeof decrypted.calendarId === 'string'
        ? decrypted.calendarId
        : (row.calendarId ?? ''),
  }
}

function serializeCategory(row: typeof calendarCategories.$inferSelect) {
  const decrypted = decryptServerJson<Record<string, unknown>>(
    row.encryptedData,
    row.iv,
    row.authTag,
    categoryContext(row.userId, row.id),
    {},
  )
  const legacyExtensions =
    decrypted.extensions && typeof decrypted.extensions === 'object'
      ? (decrypted.extensions as Record<string, unknown>)
      : {}
  return {
    ...legacyExtensions,
    ...decrypted,
    id: row.id,
    name: typeof decrypted.name === 'string' ? decrypted.name : row.name,
    color: typeof decrypted.color === 'string' ? decrypted.color : row.color,
    keywords: Array.isArray(decrypted.keywords)
      ? decrypted.keywords
      : row.keywords,
    position:
      typeof decrypted.position === 'number'
        ? decrypted.position
        : row.position,
  }
}

function serializeBookmark(row: typeof calendarBookmarks.$inferSelect) {
  const decrypted = decryptServerJson<Record<string, unknown>>(
    row.encryptedData,
    row.iv,
    row.authTag,
    bookmarkContext(row.userId, row.id),
    {},
  )
  return {
    ...decrypted,
    id: row.id,
    eventId:
      typeof decrypted.eventId === 'string' ? decrypted.eventId : row.eventId,
    title: typeof decrypted.title === 'string' ? decrypted.title : row.title,
    startDate:
      typeof decrypted.startDate === 'string'
        ? decrypted.startDate
        : row.startDate.toISOString(),
    endDate:
      typeof decrypted.endDate === 'string'
        ? decrypted.endDate
        : row.endDate.toISOString(),
    color: typeof decrypted.color === 'string' ? decrypted.color : row.color,
  }
}

function serializeCountdown(row: typeof calendarCountdowns.$inferSelect) {
  const decrypted = decryptServerJson<Record<string, unknown>>(
    row.encryptedData,
    row.iv,
    row.authTag,
    countdownContext(row.userId, row.id),
    {},
  )
  return {
    ...decrypted,
    id: row.id,
    title:
      typeof decrypted.title === 'string'
        ? decrypted.title
        : typeof decrypted.name === 'string'
          ? decrypted.name
          : row.title,
    dueDate:
      typeof decrypted.dueDate === 'string'
        ? decrypted.dueDate
        : typeof decrypted.date === 'string'
          ? decrypted.date
          : row.dueDate.toISOString(),
    eventId:
      typeof decrypted.eventId === 'string'
        ? decrypted.eventId
        : (row.eventId ?? ''),
  }
}

function serializeSettings(
  userId: string,
  value: Record<string, unknown> | null | undefined,
) {
  const envelope = value as EncryptedSettingsEnvelope | null | undefined
  if (envelope?.encryptedData && envelope.iv && envelope.authTag) {
    return decryptServerJson<Record<string, unknown>>(
      envelope.encryptedData,
      envelope.iv,
      envelope.authTag,
      settingsContext(userId),
      {},
    )
  }
  return value ?? {}
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
  const recurrence =
    typeof input.recurrence === 'string' ? input.recurrence : 'none'
  const color =
    typeof input.color === 'string' && input.color ? input.color : '#3b82f6'
  const encrypted = encryptServerJson(
    {
      ...input,
      id: eventId,
      title,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      isAllDay: Boolean(input.isAllDay),
      recurrence,
      calendarId: calendarId ?? '',
      color,
      participants: Array.isArray(input.participants) ? input.participants : [],
      notification:
        typeof input.notification === 'number' ? input.notification : 0,
      description: input.description ?? '',
      location: input.location ?? '',
    },
    eventContext(userId, eventId),
  )
  const now = new Date()
  return {
    id: eventId,
    userId,
    title: ENCRYPTED_TEXT_PLACEHOLDER,
    startDate: ENCRYPTED_DATE_PLACEHOLDER,
    endDate: ENCRYPTED_DATE_PLACEHOLDER,
    isAllDay: false,
    recurrence: 'none',
    calendarId,
    color: '#3b82f6',
    searchableText: '',
    ...encrypted,
    createdAt: now,
    updatedAt: now,
  }
}

function settingsValues(userId: string, settings: Record<string, unknown>) {
  return encryptServerJson(settings, settingsContext(userId))
}

function bookmarkValues(userId: string, input: CalendarBookmarkPayload) {
  const bookmarkId = input.id || id('bmk')
  const startDate = asDate(input.startDate)
  const endDate = asDate(input.endDate, startDate)
  const title = typeof input.title === 'string' ? input.title : 'Untitled event'
  const color =
    typeof input.color === 'string' && input.color ? input.color : '#3b82f6'
  const encrypted = encryptServerJson(
    {
      ...input,
      id: bookmarkId,
      eventId: typeof input.eventId === 'string' ? input.eventId : bookmarkId,
      title,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      color,
    },
    bookmarkContext(userId, bookmarkId),
  )
  const now = new Date()
  return {
    id: bookmarkId,
    userId,
    eventId: typeof input.eventId === 'string' ? input.eventId : bookmarkId,
    title: ENCRYPTED_TEXT_PLACEHOLDER,
    startDate: ENCRYPTED_DATE_PLACEHOLDER,
    endDate: ENCRYPTED_DATE_PLACEHOLDER,
    color: '#3b82f6',
    ...encrypted,
    createdAt: now,
    updatedAt: now,
  }
}

function countdownValues(userId: string, input: CalendarCountdownPayload) {
  const countdownId = input.id || id('cnt')
  const dueDate = asDate(input.dueDate ?? input.date)
  const title =
    typeof input.title === 'string'
      ? input.title
      : typeof input.name === 'string'
        ? input.name
        : 'Untitled countdown'
  const encrypted = encryptServerJson(
    {
      ...input,
      id: countdownId,
      title,
      name: typeof input.name === 'string' ? input.name : title,
      dueDate: dueDate.toISOString(),
      date:
        typeof input.date === 'string' || input.date instanceof Date
          ? asDate(input.date).toISOString()
          : dueDate.toISOString(),
      eventId: typeof input.eventId === 'string' ? input.eventId : '',
    },
    countdownContext(userId, countdownId),
  )
  const now = new Date()
  return {
    id: countdownId,
    userId,
    title: ENCRYPTED_TEXT_PLACEHOLDER,
    dueDate: ENCRYPTED_DATE_PLACEHOLDER,
    eventId:
      typeof input.eventId === 'string' && input.eventId ? input.eventId : null,
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
    const rangeStart = start ? asDate(start) : null
    const rangeEnd = end ? asDate(end) : null

    const [events, categories, settings, bookmarks, countdowns] =
      await Promise.all([
        db
          .select()
          .from(calendarBackups)
          .where(eq(calendarBackups.userId, userId)),
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

    const serializedEvents = events.map(serializeEvent).filter((event) => {
      if (!rangeStart || !rangeEnd) return true
      const eventStart = asDate(event.startDate)
      const eventEnd = asDate(event.endDate, eventStart)
      return (
        (eventStart >= rangeStart && eventStart <= rangeEnd) ||
        (eventEnd >= rangeStart && eventEnd <= rangeEnd) ||
        (eventStart <= rangeStart && eventEnd >= rangeEnd)
      )
    })

    return jsonNoStore({
      events: serializedEvents,
      categories: categories.map(serializeCategory),
      settings: serializeSettings(userId, settings[0]?.settings),
      bookmarks: bookmarks.map(serializeBookmark),
      countdowns: countdowns.map(serializeCountdown),
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
    const bookmarks = Array.isArray(body?.bookmarks) ? body.bookmarks : null
    const countdowns = Array.isArray(body?.countdowns) ? body.countdowns : null
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
          {
            ...category,
            id: categoryId,
            name:
              typeof category.name === 'string' ? category.name : 'Untitled',
            color:
              typeof category.color === 'string' ? category.color : '#3b82f6',
            keywords: Array.isArray(category.keywords) ? category.keywords : [],
            position:
              typeof category.position === 'number' ? category.position : 0,
          },
          categoryContext(userId, categoryId),
        )
        const values = {
          id: categoryId,
          userId,
          name: ENCRYPTED_TEXT_PLACEHOLDER,
          color: '#3b82f6',
          keywords: [],
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

      if (bookmarks) {
        await tx
          .delete(calendarBookmarks)
          .where(eq(calendarBookmarks.userId, userId))
        for (const bookmark of bookmarks as CalendarBookmarkPayload[]) {
          await tx
            .insert(calendarBookmarks)
            .values(bookmarkValues(userId, bookmark))
        }
      }

      if (countdowns) {
        await tx
          .delete(calendarCountdowns)
          .where(eq(calendarCountdowns.userId, userId))
        for (const countdown of countdowns as CalendarCountdownPayload[]) {
          await tx
            .insert(calendarCountdowns)
            .values(countdownValues(userId, countdown))
        }
      }

      if (body?.settings && typeof body.settings === 'object') {
        const encryptedSettings = settingsValues(
          userId,
          body.settings as Record<string, unknown>,
        )
        await tx
          .insert(userSettings)
          .values({
            userId,
            settings: encryptedSettings,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: userSettings.userId,
            set: { settings: encryptedSettings, updatedAt: now },
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
