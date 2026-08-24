import { NextResponse } from 'next/server'
import { WebhookReceiver } from 'livekit-server-sdk'
import {
  closeOpenAttendance,
  closeSession,
  getMeeting,
  getOpenSession,
  openSession,
  recordJoin,
  recordLeave,
} from '@zntr/meetings'
import { getDb } from '@/lib/drizzle'

export const runtime = 'nodejs'

/**
 * Attendance and duration come from here and nowhere else (ADR 0020): the
 * media server is the only party that knows who was actually connected and
 * for how long, and a client-reported number cannot be verified.
 *
 * Deliveries are retried and can arrive out of order, so the handlers are
 * idempotent and open a missing session rather than dropping the event.
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

    switch (event.event) {
      case 'room_started': {
        await openSession(db, {
          id: event.room?.sid || undefined,
          meetingId: roomName,
          startedAt: at,
        })
        break
      }
      case 'room_finished': {
        const open = await getOpenSession(db, roomName)
        if (open) {
          // Anyone still marked present left when the room did.
          await closeOpenAttendance(db, open.id, at)
          await closeSession(db, roomName, at)
        }
        break
      }
      case 'participant_joined': {
        const identity = event.participant?.identity
        if (!identity) break
        const session = await openSession(db, {
          id: event.room?.sid || undefined,
          meetingId: roomName,
          startedAt: at,
        })
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
        const open = await getOpenSession(db, roomName)
        if (!identity || !open) break
        await recordLeave(db, {
          sessionId: open.id,
          participantIdentity: identity,
          leftAt: at,
        })
        break
      }
      default:
        return NextResponse.json({ skipped: true })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[webhooks:livekit]', error)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }
}
