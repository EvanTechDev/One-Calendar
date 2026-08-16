import { getDb } from '@/lib/drizzle/client'
import { bookmarkedEvents, calendarEvents, user } from '@/lib/drizzle/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { decryptEvent } from '@/lib/api-helpers'
import { isEventViewableBy } from '@/lib/bookmarks'
import { InvalidEventQueryError } from './errors'
import crypto from 'crypto'

const MAX_PAGE_LIMIT = 100

export class BookmarkError extends InvalidEventQueryError {}

async function getUserEmail(userId: string): Promise<string> {
  const db = await getDb()
  const [row] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
  return row?.email ?? ''
}

export async function bookmarkEvent(
  userId: string,
  { eventId }: { eventId: string },
) {
  const email = await getUserEmail(userId)
  if (!(await isEventViewableBy(eventId, { id: userId, email }))) {
    throw new BookmarkError('Forbidden')
  }

  const id = crypto.randomUUID()
  const db = await getDb()

  const [row] = await db
    .insert(bookmarkedEvents)
    .values({ id, userId, eventId })
    .onConflictDoNothing()
    .returning()

  if (row) return row

  const [existing] = await db
    .select()
    .from(bookmarkedEvents)
    .where(
      and(
        eq(bookmarkedEvents.userId, userId),
        eq(bookmarkedEvents.eventId, eventId),
      ),
    )
    .limit(1)

  return existing
}

export async function listBookmarkedEvents(
  userId: string,
  {
    page = 1,
    limit = 20,
    eventId,
  }: { page?: number; limit?: number; eventId?: string } = {},
) {
  const safePage = Math.max(Math.floor(page), 1)
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), MAX_PAGE_LIMIT)
  const db = await getDb()

  const filters = [eq(bookmarkedEvents.userId, userId)]
  if (eventId) filters.push(eq(bookmarkedEvents.eventId, eventId))
  const where = filters.length === 1 ? filters[0] : and(...filters)

  const [results, countResult] = await Promise.all([
    db
      .select({ bookmark: bookmarkedEvents, event: calendarEvents })
      .from(bookmarkedEvents)
      .innerJoin(
        calendarEvents,
        eq(bookmarkedEvents.eventId, calendarEvents.id),
      )
      .where(where)
      .orderBy(desc(bookmarkedEvents.createdAt))
      .limit(safeLimit)
      .offset((safePage - 1) * safeLimit),
    db
      .select({ count: sql<number>`count(*)` })
      .from(bookmarkedEvents)
      .where(where),
  ])

  const email = await getUserEmail(userId)
  const bookmarks = await Promise.all(
    results.map(async ({ bookmark, event }) => {
      const visible = await isEventViewableBy(event.id, {
        id: userId,
        email,
      })
      return {
        id: bookmark.id,
        eventId: bookmark.eventId,
        createdAt: bookmark.createdAt,
        event: visible
          ? decryptEvent(event)
          : {
              ...event,
              title: undefined,
              description: undefined,
              location: undefined,
              participants: [],
            },
      }
    }),
  )

  return {
    bookmarks,
    total: countResult[0]?.count ?? 0,
    page: safePage,
    limit: safeLimit,
  }
}

export async function removeBookmark(
  userId: string,
  { eventId }: { eventId: string },
) {
  const db = await getDb()
  await db
    .delete(bookmarkedEvents)
    .where(
      and(
        eq(bookmarkedEvents.userId, userId),
        eq(bookmarkedEvents.eventId, eventId),
      ),
    )
  return { success: true }
}
