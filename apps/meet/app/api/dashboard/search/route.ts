import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  getEventTitlesForMeetings,
  getMeetingSummaries,
  searchMeetings,
} from '@zntr/meetings'
import { getDb } from '@/lib/drizzle'
import { getServerSession } from '@/lib/auth/server'
import { readEventTitle } from '@/lib/event-title'

/** Searches the caller's own meetings. Scoped by organiser id, never by input. */
export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (!query) return NextResponse.json({ meetings: [] })

  try {
    const db = getDb()
    const found = await searchMeetings(db, session.user.id, query, 20)
    const ids = found.map((row) => row.id)
    const [titles, summaries] = await Promise.all([
      getEventTitlesForMeetings(db, ids),
      getMeetingSummaries(db, ids),
    ])

    return NextResponse.json({
      meetings: found.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        endedAt: row.endedAt ? row.endedAt.toISOString() : null,
        eventTitle:
          row.eventId && titles[row.id]
            ? readEventTitle(row.eventId, titles[row.id]!)
            : null,
        totalMinutes: summaries[row.id]?.totalMinutes ?? 0,
        attendees: summaries[row.id]?.attendees ?? 0,
      })),
    })
  } catch (error) {
    console.error('[dashboard:search]', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
