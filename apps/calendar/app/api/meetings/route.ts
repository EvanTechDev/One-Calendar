import { type NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import {
  createMeeting,
  deleteMeetingsForEvent,
  deleteProvisionalMeetingForEvent,
  generateMeetingId,
  getMeeting,
  getMeetingForEvent,
} from '@zntr/meetings'
import { getDb } from '@/lib/drizzle/client'
import { calendarEvents } from '@/lib/drizzle/schema'
import { getAuthedUser } from '@/lib/api-helpers'
import { meetingUrl } from '@/lib/meetings'
import { checkFixedWindowLimit, rateLimitedResponse } from '@/lib/rate-limit'

export const runtime = 'nodejs'

/**
 * Event Meetings: a calendar event gets a Zentra Meet room, attached through
 * `meeting.eventId` and nowhere else (ADR-0019 — no URL column on the event,
 * so End, reopen, and delete never need a second write).
 *
 * A Meeting is created the moment the organiser asks for one, before the event
 * is saved, so the link is copyable immediately (Google Calendar's behaviour,
 * which ADR-0018 makes this integration's default). Such a row is
 * *provisional*: it carries an `expiresAt`, which is what makes the ADR-0018
 * expired-meeting sweep responsible for the ones nobody ever cleans up (a
 * killed tab runs no code). Dismissing the editor deletes it (below); SAVING
 * the event commits it, and that happens inside the events route rather than
 * here — a client that dies between the two calls would otherwise leave a real
 * Event Meeting silently expiring.
 *
 * Every handler wraps its work in try/catch and logs, matching the convention
 * every route in apps/meet already follows. Without it an unexpected throw
 * surfaced as an opaque framework 500 with nothing in the logs to debug from.
 */

interface Body {
  eventId?: string
  /**
   * True when the event does not exist yet. The client owns the id it will save
   * under, so the Meeting can be attached to it up front — but a provisional
   * row must never be mistaken for a committed Event Meeting.
   */
  provisional?: boolean
}

/** How many colliding ids to tolerate before giving up. */
const MAX_ID_ATTEMPTS = 5

/**
 * How long a provisional Meeting survives without its event being saved.
 *
 * Sized to bound one editing session generously, not to be a retention policy:
 * the row is either committed or deleted within seconds in every path the user
 * actually drives. This window only covers the paths where no cleanup code can
 * run — a killed tab, a crashed browser, a lost network — where the ADR-0018
 * sweep is the honest answer.
 */
const PROVISIONAL_TTL_MS = 12 * 60 * 60 * 1000

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

/**
 * Whether ANY event carries this id, regardless of owner.
 *
 * Provisional creation excuses a *missing* event row, and `loadOwnedEvent`
 * returns null for both "no such event" and "somebody else's event" — so
 * without this distinction, passing `provisional: true` with a stranger's event
 * id would attach a room to their event. The next thing the real owner's editor
 * does is resolve the meeting for that event id, and it would hand them the
 * attacker's room.
 */
async function eventExists(eventId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: calendarEvents.id })
    .from(calendarEvents)
    .where(eq(calendarEvents.id, eventId))
  return row !== undefined
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

    // Provisional creation accepts an id no row exists for, so it cannot lean on
    // event ownership to bound how many rooms one account can mint. Keyed per
    // user rather than per IP: a session is available here, and per-user is the
    // limit that actually means something (see lib/rate-limit.ts).
    if (body?.provisional === true) {
      const limit = await checkFixedWindowLimit({
        name: 'event-meeting-create',
        subject: user.id,
        limit: 60,
        windowSeconds: 3600,
      })
      if (!limit.allowed) return rateLimitedResponse(limit.retryAfter)
    }

    const event = await loadOwnedEvent(eventId, user.id)
    // A draft has no row yet. The client chose the id it will save under, so the
    // Meeting can point at it now; `provisional` says so explicitly rather than
    // being inferred from a missing row.
    //
    // "Missing" has to mean missing to EVERYONE, not just unreadable by this
    // caller: `loadOwnedEvent` returns null for a stranger's event too, and
    // attaching a room to that would plant it where its real owner's editor
    // would then find and show it.
    if (!event) {
      if (body?.provisional !== true || (await eventExists(eventId))) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }
    }
    const ownerId = event ? (event.seriesId ?? event.id) : eventId

    const db = getDb()
    // Idempotent: a double-click, or add → close → add, must not mint a second
    // room for one event, and must not leak the first one's row.
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

    await createMeeting(db, {
      id,
      organiserId: user.id,
      eventId: ownerId,
      expiresAt: event ? null : new Date(Date.now() + PROVISIONAL_TTL_MS),
    })
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

    const db = getDb()

    // The editor-close path. Deliberately NOT gated on whether the event row
    // exists: a draft saved mid-session has a row, and an abandoned draft may
    // share an id with nothing at all. The operation's own `expiresAt IS NOT
    // NULL` predicate is what keeps a committed Event Meeting — one whose link
    // participants already hold — safe from an editor dismissal.
    if (body?.provisional === true) {
      const event = await loadOwnedEvent(eventId, user.id)
      const removed = await deleteProvisionalMeetingForEvent(
        db,
        event ? (event.seriesId ?? event.id) : eventId,
        user.id,
      )
      return NextResponse.json({ success: true, removed: removed.length })
    }

    const event = await loadOwnedEvent(eventId, user.id)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    await deleteMeetingsForEvent(db, event.seriesId ?? event.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[calendar:meetings:DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to remove the meeting' },
      { status: 500 },
    )
  }
}
