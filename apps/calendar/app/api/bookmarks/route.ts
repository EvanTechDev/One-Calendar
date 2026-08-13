import { type NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import {
  bookmarkedEvents,
  calendarEvents,
  eventInvites,
} from '@/lib/drizzle/schema'
import { eq, and, desc } from 'drizzle-orm'
import crypto from 'crypto'
import { getAuthedUser, decryptEvent } from '@/lib/api-helpers'
import { bookmarkSchema, firstZodMessage } from '@/lib/validation'

export const runtime = 'nodejs'

export async function isEventViewableBy(
  eventId: string,
  user: { id: string; email: string },
): Promise<boolean> {
  const [owned] = await getDb()
    .select({ id: calendarEvents.id })
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.id, eventId),
        eq(calendarEvents.userId, user.id),
      ),
    )
    .limit(1)
  if (owned) return true

  const [invite] = await getDb()
    .select({
      id: eventInvites.id,
      email: eventInvites.email,
      addedToCalendar: eventInvites.addedToCalendar,
      expiresAt: eventInvites.expiresAt,
    })
    .from(eventInvites)
    .where(
      and(
        eq(eventInvites.eventId, eventId),
        eq(eventInvites.email, user.email.toLowerCase()),
      ),
    )
    .limit(1)

  return (
    !!invite?.addedToCalendar &&
    (!invite.expiresAt || invite.expiresAt > new Date())
  )
}

export const GET = async function GET() {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const results = await getDb()
    .select({
      bookmark: bookmarkedEvents,
      event: calendarEvents,
    })
    .from(bookmarkedEvents)
    .innerJoin(calendarEvents, eq(bookmarkedEvents.eventId, calendarEvents.id))
    .where(eq(bookmarkedEvents.userId, user.id))
    .orderBy(desc(bookmarkedEvents.createdAt))

  const bookmarks = await Promise.all(
    results.map(async ({ bookmark, event }) => {
      const visible = await isEventViewableBy(event.id, user)
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

  return NextResponse.json({ bookmarks })
}

export const POST = async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bookmarkSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstZodMessage(parsed.error) },
      { status: 400 },
    )
  }
  const body = parsed.data
  if (!body.eventId)
    return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })

  if (!(await isEventViewableBy(body.eventId, user))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const id = body.id ?? crypto.randomUUID()

  const [bm] = await getDb()
    .insert(bookmarkedEvents)
    .values({
      id,
      userId: user.id,
      eventId: body.eventId,
    })
    .onConflictDoNothing()
    .returning()

  return NextResponse.json({ bookmark: bm })
}

export const DELETE = async function DELETE(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, eventId } = body as { id?: string; eventId?: string }

  if (id) {
    await getDb()
      .delete(bookmarkedEvents)
      .where(
        and(eq(bookmarkedEvents.id, id), eq(bookmarkedEvents.userId, user.id)),
      )
  } else if (eventId) {
    await getDb()
      .delete(bookmarkedEvents)
      .where(
        and(
          eq(bookmarkedEvents.eventId, eventId),
          eq(bookmarkedEvents.userId, user.id),
        ),
      )
  } else {
    return NextResponse.json(
      { error: 'Missing id or eventId' },
      { status: 400 },
    )
  }

  return NextResponse.json({ success: true })
}
