import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { endMeeting, getMeeting, reopenMeeting } from '@zntr/meetings'
import { getDb } from '@/lib/drizzle'
import { isOrganiser } from '@/lib/organiser'
import { getRoomService } from '@/lib/livekit-server'

interface EndRequestBody {
  creatorToken?: string
  reopen?: boolean
}

/**
 * End Meeting — the Organiser's explicit act of closing a Meeting for
 * everyone (ADR 0016). Leaving, disconnecting, or closing a tab never
 * reaches here; an empty room closes itself on the media server's timeout.
 *
 * Pass `{ reopen: true }` to clear the ended state: the link never changed,
 * so a recurring meeting reuses it week after week (ADR 0019).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const db = getDb()
    const meeting = await getMeeting(db, id)
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    let body: EndRequestBody = {}
    try {
      body = (await request.json()) as EndRequestBody
    } catch {
      // An empty body is fine for signed-in Organisers.
    }

    if (!(await isOrganiser(meeting, body.creatorToken))) {
      return NextResponse.json(
        { error: 'Only the organiser can do this' },
        { status: 403 },
      )
    }

    if (body.reopen) {
      await reopenMeeting(db, id)
      return NextResponse.json({ ended: false })
    }

    await endMeeting(db, id)
    // Disconnect whoever is still in the room. The room may not be live,
    // which is not an error.
    try {
      await getRoomService().deleteRoom(id)
    } catch {
      // No live room to delete.
    }
    return NextResponse.json({ ended: true })
  } catch (error) {
    console.error('[meetings:end]', error)
    return NextResponse.json(
      { error: 'Failed to update the meeting' },
      { status: 500 },
    )
  }
}
