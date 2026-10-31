import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { deleteMeeting, getMeeting } from '@zntr/meetings'
import { getDb } from '@/lib/drizzle'
import { isOrganiser } from '@/lib/organiser'
import { getRoomService } from '@/lib/livekit-server'

interface Body {
  creatorToken?: string
}

/** Removes a Meeting for good. Organiser only; the link stops working. */
export async function DELETE(
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

    let body: Body = {}
    try {
      body = (await request.json()) as Body
    } catch {
      // Signed-in organisers need no body.
    }

    if (!(await isOrganiser(meeting, body.creatorToken))) {
      return NextResponse.json(
        { error: 'Only the organiser can do this' },
        { status: 403 },
      )
    }

    // Disconnect anyone still inside before the row disappears.
    try {
      await getRoomService().deleteRoom(id)
    } catch {
      // No live room.
    }
    await deleteMeeting(db, id)
    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('[meetings:delete]', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
