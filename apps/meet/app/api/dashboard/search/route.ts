import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { and, asc, eq, ilike, inArray } from 'drizzle-orm'
import {
  getEventTitlesForMeetings,
  getMeetingSummaries,
  meetingAttendance,
  meetingChatMessage,
  meetingSession,
  searchMeetings,
} from '@zntr/meetings'
import { getDb } from '@/lib/drizzle'
import { getServerSession } from '@/lib/auth/server'
import { readEventTitle } from '@/lib/event-title'
import type { MeetingMatch } from '@/lib/search-matches'

/**
 * How many reasons of each kind one row carries. Capped per kind rather than
 * in total, so a meeting where two people share the searched name still shows
 * that its chat matched too — a single total cap hid the chat line entirely.
 */
const MATCHES_PER_KIND = 1

/** Escapes LIKE metacharacters, mirroring the package's own escaping. */
function escapeLikeTerm(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/[%_]/g, (c) => `\\${c}`)
}

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
    const [titles, summaries, matches] = await Promise.all([
      getEventTitlesForMeetings(db, ids),
      getMeetingSummaries(db, ids),
      matchesForMeetings(db, ids, query),
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
        /**
         * Why this row is here. Without it a name or chat-phrase search
         * returned rows showing only a room code and a date — the match itself
         * was nowhere on screen.
         */
        matches: matches[row.id] ?? [],
      })),
    })
  } catch (error) {
    console.error('[dashboard:search]', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}

/**
 * The attendee names and chat lines that matched, per meeting.
 *
 * Read here rather than in `@zntr/meetings` because this is presentation: the
 * package answers *which meetings matched*, and adding a snippet shape to it
 * would push a UI concern into shared storage code. It queries the package's
 * exported tables, so no schema knowledge is duplicated.
 *
 * A meeting with no rows here matched on its room code — which needs no
 * explanation, the code is already the row's heading.
 */
async function matchesForMeetings(
  db: ReturnType<typeof getDb>,
  meetingIds: string[],
  query: string,
): Promise<Record<string, MeetingMatch[]>> {
  if (meetingIds.length === 0) return {}
  const term = `%${escapeLikeTerm(query)}%`

  const [attendees, chat] = await Promise.all([
    db
      .select({
        meetingId: meetingSession.meetingId,
        name: meetingAttendance.participantName,
      })
      .from(meetingAttendance)
      .innerJoin(
        meetingSession,
        eq(meetingAttendance.sessionId, meetingSession.id),
      )
      .where(
        and(
          inArray(meetingSession.meetingId, meetingIds),
          ilike(meetingAttendance.participantName, term),
        ),
      )
      .orderBy(asc(meetingAttendance.joinedAt)),
    db
      .select({
        meetingId: meetingChatMessage.meetingId,
        sender: meetingChatMessage.senderName,
        message: meetingChatMessage.message,
      })
      .from(meetingChatMessage)
      .where(
        and(
          inArray(meetingChatMessage.meetingId, meetingIds),
          ilike(meetingChatMessage.message, term),
        ),
      )
      .orderBy(asc(meetingChatMessage.sentAt)),
  ])

  const out: Record<string, MeetingMatch[]> = {}
  const push = (meetingId: string, match: MeetingMatch) => {
    const list = (out[meetingId] ??= [])
    if (
      list.filter((existing) => existing.kind === match.kind).length >=
      MATCHES_PER_KIND
    ) {
      return
    }
    list.push(match)
  }

  // Attendees first, so the row reads "who was there, and what was said".
  for (const row of attendees) {
    push(row.meetingId, { kind: 'attendee', name: row.name })
  }
  for (const row of chat) {
    push(row.meetingId, {
      kind: 'chat',
      sender: row.sender,
      message: row.message,
    })
  }
  return out
}
