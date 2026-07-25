import { type NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth/server'
import { db } from '@/lib/drizzle/client'
import { bookmarkedEvents, calendarEvents } from '@/lib/drizzle/schema'
import { eq, and, desc } from 'drizzle-orm'
import { decryptField, decryptJsonField } from '@/lib/field-crypto'
import crypto from 'crypto'

export const runtime = 'nodejs'

type BookmarkInput = {
  id?: string
  eventId: string
}

function decryptEvent(event: typeof calendarEvents.$inferSelect) {
  return {
    ...event,
    title: decryptField(event.id, event.title) ?? event.title,
    description: decryptField(event.id, event.description),
    location: decryptField(event.id, event.location),
    participants: decryptJsonField(
      event.id,
      event.participants as string | null | undefined,
    ),
  }
}

async function getAuthedUser() {
  const session = await getServerSession()
  if (!session?.user) return null
  return session.user
}

export const GET = async function GET() {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const results = await db
    .select({
      bookmark: bookmarkedEvents,
      event: calendarEvents,
    })
    .from(bookmarkedEvents)
    .innerJoin(calendarEvents, eq(bookmarkedEvents.eventId, calendarEvents.id))
    .where(eq(bookmarkedEvents.userId, user.id))
    .orderBy(desc(bookmarkedEvents.createdAt))

  const bookmarks = results.map(({ bookmark, event }) => ({
    id: bookmark.id,
    eventId: bookmark.eventId,
    createdAt: bookmark.createdAt,
    event: decryptEvent(event),
  }))

  return NextResponse.json({ bookmarks })
}

export const POST = async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: BookmarkInput = await request.json()
  if (!body.eventId)
    return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })

  const id = body.id ?? crypto.randomUUID()

  const [bm] = await db
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
    await db
      .delete(bookmarkedEvents)
      .where(
        and(eq(bookmarkedEvents.id, id), eq(bookmarkedEvents.userId, user.id)),
      )
  } else if (eventId) {
    await db
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
