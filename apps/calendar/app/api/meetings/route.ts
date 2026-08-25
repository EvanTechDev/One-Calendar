import { type NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import {
  createMeeting,
  deleteMeetingsForEvent,
  generateMeetingId,
  getMeeting,
  getMeetingForEvent,
} from '@zntr/meetings'
import { getDb } from '@/lib/drizzle/client'
import { calendarEvents } from '@/lib/drizzle/schema'
import { getAuthedUser } from '@/lib/api-helpers'
import { meetingUrl } from '@/lib/meetings'

export const runtime = 'nodejs'

/**
 * Event Meetings: a calendar event gets a Zentra Meet room, attached through
 * `meeting.eventId` and nowhere else (ADR-0019 — no URL column on the event,
 * so End, reopen, and delete never need a second write).
 *
 * Every handler wraps its work in try/catch and logs, matching the convention
 * every route in apps/meet already follows. Without it an unexpected throw
 * surfaced as an opaque framework 500 with nothing in the logs to debug from.
 */

interface Body {
  eventId?: string
}

/** How many colliding ids to tolerate before giving up. */
const MAX_ID_ATTEMPTS = 5

/** Resolves the row the meeting attaches to and confirms ownership. */
async function loadOwnedEvent(eventId: string, userId: string) {
  const [row] = await getDb()
    .select({
      id: calendarEvents.id,
      seriesId: calendarEvents.seriesId,
    })
    .from(calendarEvents)
    .where(
      and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)),
    )
  return row ?? null
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthedUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const eventId = new URL(request.url).searchParams.get('eventId')
    if (!eventId) {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
    }

    const event = await loadOwnedEvent(eventId, user.id)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // A Series carries its Meeting on the master row.
    const ownerId = event.seriesId ?? event.id
    const meeting = await getMeetingForEvent(getDb(), ownerId)
    if (!meeting) return NextResponse.json({ meeting: null })
    return NextResponse.json({
      meeting: { id: meeting.id, url: meetingUrl(meeting.id) },
    })
  } catch (error) {
    console.error('[calendar:meetings:GET]', error)
    return NextResponse.json(
      { error: 'Failed to load the meeting' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = (await request.json().catch(() => null)) as Body | null
    const eventId = body?.eventId
    if (!eventId) {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
    }

    const event = await loadOwnedEvent(eventId, user.id)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    const ownerId = event.seriesId ?? event.id

    const db = getDb()
    // Idempotent: a double-click must not mint a second room for one event.
    const existing = await getMeetingForEvent(db, ownerId)
    if (existing) {
      return NextResponse.json({
        meeting: { id: existing.id, url: meetingUrl(existing.id) },
      })
    }

    // Find a free code. The previous loop gave up after three tries and then
    // inserted the colliding id anyway, turning an astronomically unlikely
    // collision into a guaranteed unhandled primary-key violation. Exhausting
    // the attempts now reports a retryable failure instead.
    let id: string | null = null
    for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
      const candidate = generateMeetingId()
      if (!(await getMeeting(db, candidate))) {
        id = candidate
        break
      }
    }
    if (!id) {
      console.error(
        `[calendar:meetings:POST] no free room code after ${MAX_ID_ATTEMPTS} attempts`,
      )
      return NextResponse.json(
        { error: 'Could not allocate a meeting code — please retry' },
        { status: 503 },
      )
    }

    await createMeeting(db, { id, organiserId: user.id, eventId: ownerId })
    return NextResponse.json({ meeting: { id, url: meetingUrl(id) } })
  } catch (error) {
    console.error('[calendar:meetings:POST]', error)
    return NextResponse.json(
      { error: 'Failed to add the meeting' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthedUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = (await request.json().catch(() => null)) as Body | null
    const eventId = body?.eventId
    if (!eventId) {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
    }

    const event = await loadOwnedEvent(eventId, user.id)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    await deleteMeetingsForEvent(getDb(), event.seriesId ?? event.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[calendar:meetings:DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to remove the meeting' },
      { status: 500 },
    )
  }
}
