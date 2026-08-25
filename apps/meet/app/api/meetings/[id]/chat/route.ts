import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getMeeting, getOpenSession, retainChatMessage } from '@zntr/meetings'
import { getDb } from '@/lib/drizzle'
import { checkFixedWindowLimit, clientAddress } from '@/lib/rate-limit'
import { verifyRoomMember } from '@/lib/room-membership'

const MAX_MESSAGE_LENGTH = 4000

interface Body {
  message?: string
  /** The caller's LiveKit join token — their proof of room membership. */
  participantToken?: string
}

/**
 * Retains one chat message for a meeting's history.
 *
 * Only rooms without end-to-end encryption post here — an encrypted room's
 * messages never leave the client in readable form, and both behaviors are
 * declared on the join screen (ADR 0020). The gate is necessarily client-side
 * because the server cannot tell an encrypted room from a plain one.
 *
 * Membership is PROVEN, not asserted. The sender's identity and name are read
 * from the verified LiveKit token's claims and the body's own values are
 * ignored entirely: previously this endpoint had no auth at all and trusted
 * `senderIdentity` verbatim, so anyone with a room code could forge history as
 * any participant — and could write into an E2EE meeting's stored history,
 * breaking the "chat is not saved" promise the join screen makes.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const limit = await checkFixedWindowLimit({
      name: 'chat-retain',
      subject: clientAddress(request),
      limit: 60,
      windowSeconds: 60,
    })
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many messages' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
      )
    }

    let body: Body
    try {
      body = (await request.json()) as Body
    } catch {
      return NextResponse.json({ error: 'Malformed request' }, { status: 400 })
    }

    const message = body.message?.trim()
    if (!message) {
      return NextResponse.json({ error: 'Invalid message' }, { status: 400 })
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: 'Message too long' }, { status: 400 })
    }

    // Checked before the meeting lookup: an unauthenticated caller learns
    // nothing about whether a room code exists.
    const member = await verifyRoomMember(body.participantToken, id)
    if (!member) {
      return NextResponse.json(
        { error: 'Not in this meeting' },
        { status: 403 },
      )
    }

    const db = getDb()
    const meeting = await getMeeting(db, id)
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    const session = await getOpenSession(db, id)
    await retainChatMessage(db, {
      meetingId: id,
      sessionId: session?.id ?? null,
      // From the token's claims, never the body.
      senderIdentity: member.identity,
      senderName: member.name,
      message,
    })
    return NextResponse.json({ retained: true })
  } catch (error) {
    console.error('[meetings:chat]', error)
    return NextResponse.json({ error: 'Failed to retain' }, { status: 500 })
  }
}
