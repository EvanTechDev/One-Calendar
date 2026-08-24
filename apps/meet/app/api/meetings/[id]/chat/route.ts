import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getMeeting, getOpenSession, retainChatMessage } from '@zntr/meetings'
import { getDb } from '@/lib/drizzle'
import { checkFixedWindowLimit, clientAddress } from '@/lib/rate-limit'

const MAX_MESSAGE_LENGTH = 4000

interface Body {
  message?: string
  senderName?: string
  senderIdentity?: string
}

/**
 * Retains one chat message for a meeting's history.
 *
 * Only rooms without end-to-end encryption post here — an encrypted room's
 * messages never leave the client in readable form, and both behaviors are
 * declared on the join screen (ADR 0020). The gate is necessarily client-side
 * because the server cannot tell an encrypted room from a plain one.
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
    const senderIdentity = body.senderIdentity?.trim()
    if (!message || !senderIdentity) {
      return NextResponse.json({ error: 'Invalid message' }, { status: 400 })
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: 'Message too long' }, { status: 400 })
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
      senderIdentity,
      senderName: body.senderName?.trim() || senderIdentity,
      message,
    })
    return NextResponse.json({ retained: true })
  } catch (error) {
    console.error('[meetings:chat]', error)
    return NextResponse.json({ error: 'Failed to retain' }, { status: 500 })
  }
}
