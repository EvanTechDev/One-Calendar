import { NextResponse } from 'next/server'
import { WebhookReceiver } from 'livekit-server-sdk'
import {
  closeOpenAttendance,
  closeSessionById,
  getMeeting,
  getOpenSession,
  getSession,
  openSession,
  recordJoin,
  recordLeave,
} from '@zntr/meetings'
import { getDb } from '@/lib/drizzle'

export const runtime = 'nodejs'

/** The only events that touch attendance. Everything else is ignored. */
const HANDLED = new Set([
  'room_started',
  'room_finished',
  'participant_joined',
  'participant_left',
])

/**
 * Attendance and duration come from here and nowhere else (ADR 0020): the
 * media server is the only party that knows who was actually connected and
 * for how long, and a client-reported number cannot be verified.
 *
 * Deliveries are retried and can arrive out of order, so the handlers are
 * idempotent and self-healing. Crucially, an event that CANNOT be processed
 * must still answer 2xx: LiveKit retries non-2xx forever, so a single
 * undeliverable event answering 500 stalls attendance recording for everyone.
 */
export async function POST(request: Request) {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: 'Server is missing LiveKit configuration' },
      { status: 500 },
    )
  }

  const body = await request.text()
  const authorization = request.headers.get('authorization') ?? ''

  let event
  try {
    const receiver = new WebhookReceiver(apiKey, apiSecret)
    event = await receiver.receive(body, authorization)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Discriminate BEFORE touching the database. Track and egress events are far
  // more frequent than these four, and each one used to cost a meeting lookup
  // just to be thrown away.
  if (!HANDLED.has(event.event)) {
    return NextResponse.json({ skipped: true })
  }

  try {
    const db = getDb()
    const roomName = event.room?.name
    // Traffic for rooms we do not own (shared LiveKit project) is skipped.
    if (!roomName || !(await getMeeting(db, roomName))) {
      return NextResponse.json({ skipped: true })
    }

    const at = event.createdAt
      ? new Date(Number(event.createdAt) * 1000)
      : new Date()
    // The room sid identifies the SITTING. Keying on the meeting's "current
    // open session" instead merged distinct sittings: a room left idle
    // overnight and rejoined counted the whole night as one meeting.
    const sid = event.room?.sid || undefined

    switch (event.event) {
      case 'room_started': {
        const session = await openSession(db, {
          id: sid,
          meetingId: roomName,
          startedAt: at,
        })
        // Null means this sid is already closed — a late duplicate of an event
        // whose sitting has finished. Final, so acknowledge it.
        if (!session) return NextResponse.json({ skipped: 'already-closed' })
        break
      }
      case 'room_finished': {
        // An unknown sid here means room_finished overtook room_started.
        // Create-then-close so the ordering self-heals; previously the sitting
        // the later room_started opened was never closed, leaving its duration
        // null forever and the dashboard showing 0 min.
        const session = sid
          ? await closeSessionById(db, {
              id: sid,
              meetingId: roomName,
              endedAt: at,
            })
          : await getOpenSession(db, roomName)
        if (!session) return NextResponse.json({ skipped: 'no-session' })
        // Anyone still marked present left when the room did.
        await closeOpenAttendance(db, session.id, at)
        break
      }
      case 'participant_joined': {
        const identity = event.participant?.identity
        if (!identity) break
        const session = await openSession(db, {
          id: sid,
          meetingId: roomName,
          startedAt: at,
        })
        if (!session) return NextResponse.json({ skipped: 'already-closed' })
        await recordJoin(db, {
          sessionId: session.id,
          participantIdentity: identity,
          participantName: event.participant?.name || identity,
          joinedAt: at,
        })
        break
      }
      case 'participant_left': {
        const identity = event.participant?.identity
        if (!identity) break
        // The leave belongs to the sitting the participant was in, which may
        // already be CLOSED (room_finished can land first) — so unlike a join,
        // a closed sitting is still the right target here. One participant
        // leaving never ends the sitting, so nothing is closed.
        const session = sid
          ? ((await getSession(db, sid)) ??
            (await openSession(db, {
              id: sid,
              meetingId: roomName,
              startedAt: at,
            })))
          : await getOpenSession(db, roomName)
        if (!session) return NextResponse.json({ skipped: 'no-session' })
        await recordLeave(db, {
          sessionId: session.id,
          participantIdentity: identity,
          leftAt: at,
        })
        break
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[webhooks:livekit]', error)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }
}
