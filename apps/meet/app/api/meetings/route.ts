import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  createMeeting,
  generateCreatorToken,
  generateMeetingId,
  getMeeting,
  hashCreatorToken,
} from '@zntr/meetings'
import { getDb } from '@/lib/drizzle'
import { getServerSession } from '@/lib/auth/server'
import { checkFixedWindowLimit, clientAddress } from '@/lib/rate-limit'

/** Guest Instant Meetings expire after 7 days (ADR 0018). */
const GUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Creates an Instant Meeting.
 *
 * Meetings are owned rows (ADR 0016): a signed-in creator becomes the
 * Organiser by user id, a guest creator receives a Creator Token whose hash
 * is stored on the row. Nothing can be joined until it exists here, which is
 * what stops anonymous visitors minting tokens for arbitrary room names.
 */
export async function POST(request: NextRequest) {
  try {
    const limit = await checkFixedWindowLimit({
      name: 'meeting-create',
      subject: clientAddress(request),
      limit: 10,
      windowSeconds: 3600,
    })
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many meetings created — try again later' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
      )
    }

    let body: { e2ee?: boolean } = {}
    const text = await request.text()
    if (text) {
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        return NextResponse.json(
          { error: 'Malformed request' },
          { status: 400 },
        )
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return NextResponse.json(
          { error: 'Malformed request' },
          { status: 400 },
        )
      }
      const e2ee = (parsed as Record<string, unknown>).e2ee
      if (e2ee !== undefined && typeof e2ee !== 'boolean') {
        return NextResponse.json(
          { error: 'Invalid e2ee value' },
          { status: 400 },
        )
      }
      body = { e2ee }
    }

    const retainsChat = body.e2ee !== true

    const db = getDb()
    const session = await getServerSession()

    // Collisions are astronomically unlikely but cheap to rule out.
    let id = generateMeetingId()
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!(await getMeeting(db, id))) break
      id = generateMeetingId()
    }

    if (session) {
      await createMeeting(db, {
        id,
        organiserId: session.user.id,
        retainsChat,
      })
      return NextResponse.json({ id, joinPath: `/${id}` })
    }

    const creatorToken = generateCreatorToken()
    await createMeeting(db, {
      id,
      creatorTokenHash: hashCreatorToken(creatorToken),
      expiresAt: new Date(Date.now() + GUEST_TTL_MS),
      retainsChat,
    })
    // The only time the raw token leaves the server.
    return NextResponse.json({ id, joinPath: `/${id}`, creatorToken })
  } catch (error) {
    console.error('[meetings:create]', error)
    return NextResponse.json(
      { error: 'Failed to create the meeting' },
      { status: 500 },
    )
  }
}
