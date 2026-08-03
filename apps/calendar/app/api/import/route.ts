import { type NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import {
  calendarEvents,
  calendarCategories,
  countdowns,
  bookmarkedEvents,
  settings,
} from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'
import { encryptField, encryptJsonField } from '@/lib/field-crypto'
import { getAuthedUser } from '@/lib/api-helpers'
import crypto from 'crypto'

export const runtime = 'nodejs'

type BatchImportBody = {
  events?: Array<{
    id?: string
    title: string
    description?: string | null
    location?: string | null
    startDate: string
    endDate: string
    isAllDay?: boolean
    color?: string | null
    categoryId?: string | null
    participants?: Array<{
      name: string
      email?: string
      userId?: string
    }> | null
    notificationMinutes?: number | null
  }>
  categories?: Array<{
    id?: string
    name: string
    color: string
    sortOrder?: number
  }>
  countdowns?: Array<{
    id?: string
    name: string
    targetDate: string
    repeat?: string
    description?: string | null
    color?: string | null
    icon?: string | null
  }>
  bookmarks?: Array<{
    eventId: string
  }>
  settings?: Record<string, unknown>
}

export const POST = async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: BatchImportBody = await request.json()

  let eventsImported = 0
  let categoriesImported = 0
  let countdownsImported = 0
  let bookmarksImported = 0

  const db = await getDb()

  await db.transaction(async (tx) => {
    if (body.categories && body.categories.length > 0) {
      for (const cat of body.categories) {
        const id = cat.id ?? crypto.randomUUID()
        await tx
          .insert(calendarCategories)
          .values({
            id,
            userId: user.id,
            name: cat.name,
            color: cat.color,
            sortOrder: cat.sortOrder ?? 0,
          })
          .onConflictDoNothing()
        categoriesImported++
      }
    }

    if (body.events && body.events.length > 0) {
      for (const evt of body.events) {
        const id = evt.id ?? crypto.randomUUID()
        await tx
          .insert(calendarEvents)
          .values({
            id,
            userId: user.id,
            title: encryptField(id, evt.title) ?? '',
            description: encryptField(id, evt.description),
            location: encryptField(id, evt.location),
            startDate: new Date(evt.startDate),
            endDate: new Date(evt.endDate),
            isAllDay: evt.isAllDay ?? false,
            color: evt.color ?? null,
            categoryId: evt.categoryId ?? null,
            participants: encryptJsonField(id, evt.participants),
            notificationMinutes: evt.notificationMinutes ?? null,
          })
          .onConflictDoUpdate({
            target: calendarEvents.id,
            set: {
              title: encryptField(id, evt.title) ?? '',
              description: encryptField(id, evt.description),
              location: encryptField(id, evt.location),
              startDate: new Date(evt.startDate),
              endDate: new Date(evt.endDate),
              isAllDay: evt.isAllDay ?? false,
              color: evt.color ?? null,
              categoryId: evt.categoryId ?? null,
              participants: encryptJsonField(id, evt.participants),
              notificationMinutes: evt.notificationMinutes ?? null,
              updatedAt: new Date(),
            },
          })
        eventsImported++
      }
    }

    if (body.countdowns && body.countdowns.length > 0) {
      for (const cd of body.countdowns) {
        const id = cd.id ?? crypto.randomUUID()
        await tx
          .insert(countdowns)
          .values({
            id,
            userId: user.id,
            name: cd.name,
            targetDate: new Date(cd.targetDate),
            repeat: cd.repeat ?? 'none',
            description: cd.description ?? null,
            color: cd.color ?? null,
            icon: cd.icon ?? null,
          })
          .onConflictDoNothing()
        countdownsImported++
      }
    }

    if (body.bookmarks && body.bookmarks.length > 0) {
      for (const bm of body.bookmarks) {
        await tx
          .insert(bookmarkedEvents)
          .values({
            id: crypto.randomUUID(),
            userId: user.id,
            eventId: bm.eventId,
          })
          .onConflictDoNothing()
        bookmarksImported++
      }
    }

    if (body.settings && Object.keys(body.settings).length > 0) {
      const [existing] = await tx
        .select()
        .from(settings)
        .where(eq(settings.userId, user.id))
      const merged = {
        ...((existing?.data ?? {}) as Record<string, unknown>),
        ...body.settings,
      }
      await tx
        .insert(settings)
        .values({
          userId: user.id,
          data: merged,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: settings.userId,
          set: {
            data: merged,
            updatedAt: new Date(),
          },
        })
    }
  })

  return NextResponse.json({
    success: true,
    imported: {
      events: eventsImported,
      categories: categoriesImported,
      countdowns: countdownsImported,
      bookmarks: bookmarksImported,
    },
  })
}
