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
import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { decryptServerJson, encryptServerJson } from '@/lib/server-crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...NO_STORE_HEADERS, ...init?.headers },
  })
}

async function requireUser(log: ReturnType<typeof useLogger>) {
  const session = await getServerSession()
  const user = session?.user
  if (!user?.id) {
    log.audit?.({
      action: 'calendar_data.access',
      actor: getAuditActor(log),
      target: { type: 'calendar_data', id: 'unknown' },
      outcome: 'denied',
      reason: 'Authentication required',
    })
    return null
  }
  return user
}

function asDate(value: unknown, fallback: Date) {
  if (typeof value !== 'string') return fallback
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : date
}

function normalizeEvent(raw: any) {
  const startDate = asDate(raw?.startDate, new Date())
  const endDate = asDate(
    raw?.endDate,
    new Date(startDate.getTime() + 60 * 60 * 1000),
  )
  return {
    id: String(raw?.id || crypto.randomUUID()),
    title: String(raw?.title || ''),
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    isAllDay: Boolean(raw?.isAllDay),
    recurrence: ['none', 'daily', 'weekly', 'monthly', 'yearly'].includes(
      raw?.recurrence,
    )
      ? raw.recurrence
      : 'none',
    location: typeof raw?.location === 'string' ? raw.location : undefined,
    participants: Array.isArray(raw?.participants) ? raw.participants : [],
    notification: Number.isFinite(Number(raw?.notification))
      ? Number(raw.notification)
      : 0,
    description:
      typeof raw?.description === 'string' ? raw.description : undefined,
    color: String(raw?.color || 'bg-blue-500'),
    calendarId: String(raw?.calendarId || ''),
  }
}

function decryptRows<T>(
  rows: Array<{ encryptedData: string; iv: string; authTag: string }>,
  scope: string,
) {
  return rows.flatMap((row) => {
    try {
      return [
        decryptServerJson<T>(row.encryptedData, row.iv, row.authTag, scope),
      ]
    } catch {
      return []
    }
  })
}

export const GET = withEvlog(async function GET(req: NextRequest) {
  try {
    const log = useLogger()
    const user = await requireUser(log)
    if (!user) return jsonNoStore({ error: 'Unauthorized' }, { status: 401 })

    const now = new Date()
    const start = asDate(
      req.nextUrl.searchParams.get('start'),
      new Date(now.getFullYear(), now.getMonth() - 1, 1),
    )
    const end = asDate(
      req.nextUrl.searchParams.get('end'),
      new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999),
    )

    const [eventRows, categoryRows, settingsRow, bookmarkRows, countdownRows] =
      await Promise.all([
        db
          .select()
          .from(calendarBackups)
          .where(
            and(
              eq(calendarBackups.userId, user.id),
              lte(calendarBackups.startDate, end),
              gte(calendarBackups.endDate, start),
            ),
          )
          .orderBy(asc(calendarBackups.startDate)),
        db
          .select()
          .from(calendarCategories)
          .where(eq(calendarCategories.userId, user.id))
          .orderBy(asc(calendarCategories.position)),
        db.select().from(userSettings).where(eq(userSettings.userId, user.id)),
        db
          .select()
          .from(calendarBookmarks)
          .where(eq(calendarBookmarks.userId, user.id)),
        db
          .select()
          .from(calendarCountdowns)
          .where(eq(calendarCountdowns.userId, user.id)),
      ])

    return jsonNoStore({
      backend: 'postgres',
      range: { start: start.toISOString(), end: end.toISOString() },
      events: decryptRows(eventRows, 'calendar-event'),
      calendars: decryptRows(categoryRows, 'calendar-category'),
      settings: settingsRow[0]?.settings ?? {},
      bookmarks: decryptRows(bookmarkRows, 'calendar-bookmark'),
      countdowns: decryptRows(countdownRows, 'calendar-countdown'),
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error'
    return jsonNoStore({ error: message }, { status: 500 })
  }
})

export const POST = withEvlog(async function POST(req: NextRequest) {
  try {
    const log = useLogger()
    const [user, body] = await Promise.all([requireUser(log), req.json()])
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const now = new Date()

    if (body?.event) {
      const event = normalizeEvent(body.event)
      const encrypted = encryptServerJson(event, 'calendar-event')
      await db
        .insert(calendarBackups)
        .values({
          id: event.id,
          userId: user.id,
          ...encrypted,
          startDate: new Date(event.startDate),
          endDate: new Date(event.endDate),
          calendarId: event.calendarId || null,
          timestamp: now,
        })
        .onConflictDoUpdate({
          target: calendarBackups.id,
          set: {
            ...encrypted,
            startDate: new Date(event.startDate),
            endDate: new Date(event.endDate),
            calendarId: event.calendarId || null,
            timestamp: now,
          },
        })
    }

    if (Array.isArray(body?.events)) {
      for (const raw of body.events) {
        const event = normalizeEvent(raw)
        const encrypted = encryptServerJson(event, 'calendar-event')
        await db
          .insert(calendarBackups)
          .values({
            id: event.id,
            userId: user.id,
            ...encrypted,
            startDate: new Date(event.startDate),
            endDate: new Date(event.endDate),
            calendarId: event.calendarId || null,
            timestamp: now,
          })
          .onConflictDoUpdate({
            target: calendarBackups.id,
            set: {
              ...encrypted,
              startDate: new Date(event.startDate),
              endDate: new Date(event.endDate),
              calendarId: event.calendarId || null,
              timestamp: now,
            },
          })
      }
    }

    if (Array.isArray(body?.calendars)) {
      for (const [position, category] of body.calendars.entries()) {
        if (!category?.id) continue
        const encrypted = encryptServerJson(category, 'calendar-category')
        await db
          .insert(calendarCategories)
          .values({
            id: String(category.id),
            userId: user.id,
            ...encrypted,
            position,
            timestamp: now,
          })
          .onConflictDoUpdate({
            target: calendarCategories.id,
            set: { ...encrypted, position, timestamp: now },
          })
      }
    }

    if (body?.settings && typeof body.settings === 'object') {
      await db
        .insert(userSettings)
        .values({ userId: user.id, settings: body.settings, timestamp: now })
        .onConflictDoUpdate({
          target: userSettings.userId,
          set: { settings: body.settings, timestamp: now },
        })
    }

    if (Array.isArray(body?.bookmarks)) {
      await db
        .delete(calendarBookmarks)
        .where(eq(calendarBookmarks.userId, user.id))
      for (const bookmark of body.bookmarks) {
        const id = String(
          bookmark?.id || bookmark?.eventId || crypto.randomUUID(),
        )
        const encrypted = encryptServerJson(bookmark, 'calendar-bookmark')
        await db.insert(calendarBookmarks).values({
          id,
          userId: user.id,
          eventId: String(bookmark?.eventId || bookmark?.id || ''),
          ...encrypted,
          timestamp: now,
        })
      }
    }

    if (Array.isArray(body?.countdowns)) {
      await db
        .delete(calendarCountdowns)
        .where(eq(calendarCountdowns.userId, user.id))
      for (const countdown of body.countdowns) {
        const id = String(countdown?.id || crypto.randomUUID())
        const encrypted = encryptServerJson(countdown, 'calendar-countdown')
        await db.insert(calendarCountdowns).values({
          id,
          userId: user.id,
          ...encrypted,
          timestamp: now,
        })
      }
    }

    log.audit?.({
      action: 'calendar_data.upsert',
      actor: getAuditActor(log, {
        type: 'user',
        id: user.id,
        email: user.email,
      }),
      target: { type: 'calendar_data', id: user.id },
      outcome: 'success',
      reason: 'User saved server-encrypted calendar data',
    })
    return NextResponse.json({ success: true, backend: 'postgres' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

export const DELETE = withEvlog(async function DELETE(req: NextRequest) {
  try {
    const log = useLogger()
    const user = await requireUser(log)
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => null)
    if (body?.eventId) {
      await db
        .delete(calendarBackups)
        .where(
          and(
            eq(calendarBackups.userId, user.id),
            eq(calendarBackups.id, String(body.eventId)),
          ),
        )
    } else if (body?.categoryId) {
      if (body?.deleteEvents) {
        await db
          .delete(calendarBackups)
          .where(
            and(
              eq(calendarBackups.userId, user.id),
              eq(calendarBackups.calendarId, String(body.categoryId)),
            ),
          )
      }
      await db
        .delete(calendarCategories)
        .where(
          and(
            eq(calendarCategories.userId, user.id),
            eq(calendarCategories.id, String(body.categoryId)),
          ),
        )
    } else {
      await Promise.all([
        db.delete(calendarBackups).where(eq(calendarBackups.userId, user.id)),
        db
          .delete(calendarCategories)
          .where(eq(calendarCategories.userId, user.id)),
        db
          .delete(calendarBookmarks)
          .where(eq(calendarBookmarks.userId, user.id)),
        db
          .delete(calendarCountdowns)
          .where(eq(calendarCountdowns.userId, user.id)),
        db.delete(userSettings).where(eq(userSettings.userId, user.id)),
      ])
    }

    return NextResponse.json({ success: true, backend: 'postgres' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
