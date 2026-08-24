import { and, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm'
import {
  meeting,
  meetingAttendance,
  meetingChatMessage,
  meetingSession,
} from './schema'
import { readonlyCalendarEvents } from './readonly-calendar'
import type { Meeting } from './schema'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

export interface UpcomingEventMeeting {
  meetingId: string
  eventId: string
  title: string
  startDate: Date
  endDate: Date
}

/**
 * Event Meetings on the user's calendar starting inside the window.
 *
 * Joins through the read-only description of `calendar_events` (ADR 0020) —
 * the calendar app owns that table; this package only reads five columns of
 * it for exactly this query.
 */
export async function listUpcomingEventMeetings(
  db: Db,
  userId: string,
  days = 7,
  now: Date = new Date(),
): Promise<UpcomingEventMeeting[]> {
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  const rows = await db
    .select({
      meetingId: meeting.id,
      eventId: readonlyCalendarEvents.id,
      title: readonlyCalendarEvents.title,
      startDate: readonlyCalendarEvents.startDate,
      endDate: readonlyCalendarEvents.endDate,
    })
    .from(meeting)
    .innerJoin(
      readonlyCalendarEvents,
      eq(meeting.eventId, readonlyCalendarEvents.id),
    )
    .where(
      and(
        eq(readonlyCalendarEvents.userId, userId),
        gte(readonlyCalendarEvents.startDate, now),
        lte(readonlyCalendarEvents.startDate, until),
      ),
    )
    .orderBy(readonlyCalendarEvents.startDate)
  return rows
}

export interface MeetingSessionStats {
  sessionId: string
  startedAt: Date
  endedAt: Date | null
  /** Whole minutes; null while the sitting is still open. */
  durationMinutes: number | null
  attendees: { identity: string; name: string; minutes: number }[]
}

export interface MeetingStats {
  sessions: MeetingSessionStats[]
  totalMinutes: number
  distinctAttendees: number
}

/**
 * Duration and attendance for one meeting, aggregated from the
 * webhook-written tables (ADR 0020). Open sittings contribute attendees but
 * no duration — an unfinished meeting has no length yet.
 */
export async function getMeetingStats(
  db: Db,
  meetingId: string,
): Promise<MeetingStats> {
  const sessions = await db
    .select()
    .from(meetingSession)
    .where(eq(meetingSession.meetingId, meetingId))
    .orderBy(desc(meetingSession.startedAt))

  if (sessions.length === 0) {
    return { sessions: [], totalMinutes: 0, distinctAttendees: 0 }
  }

  const attendance = await db
    .select()
    .from(meetingAttendance)
    .where(
      inArray(
        meetingAttendance.sessionId,
        sessions.map((s: { id: string }) => s.id),
      ),
    )

  const identities = new Set<string>()
  const stats: MeetingSessionStats[] = sessions.map(
    (session: {
      id: string
      startedAt: Date
      endedAt: Date | null
    }): MeetingSessionStats => {
      const rows = attendance.filter(
        (a: { sessionId: string }) => a.sessionId === session.id,
      )
      for (const row of rows) identities.add(row.participantIdentity)
      return {
        sessionId: session.id,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationMinutes: session.endedAt
          ? Math.max(
              1,
              Math.round(
                (session.endedAt.getTime() - session.startedAt.getTime()) /
                  60000,
              ),
            )
          : null,
        attendees: rows.map(
          (row: {
            participantIdentity: string
            participantName: string
            joinedAt: Date
            leftAt: Date | null
          }) => ({
            identity: row.participantIdentity,
            name: row.participantName,
            minutes: Math.max(
              1,
              Math.round(
                ((row.leftAt ?? new Date()).getTime() -
                  row.joinedAt.getTime()) /
                  60000,
              ),
            ),
          }),
        ),
      }
    },
  )

  return {
    sessions: stats,
    totalMinutes: stats.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0),
    distinctAttendees: identities.size,
  }
}

/**
 * Searches the user's own meetings by room code, attendee name, or retained
 * chat text. Deliberately `ilike` rather than a full-text index (ADR 0020) —
 * the corpus is one user's meeting history.
 *
 * Event titles are deliberately NOT searched: the calendar encrypts them at
 * rest, so a LIKE against the stored column would match ciphertext and find
 * nothing. Searching them would require decrypting every candidate row in
 * application code, which is a different (and much more expensive) design
 * than this one.
 */
export async function searchMeetings(
  db: Db,
  userId: string,
  query: string,
  limit = 20,
): Promise<Meeting[]> {
  const term = `%${query.trim()}%`
  if (query.trim().length === 0) return []

  const attendeeMatches = db
    .select({ id: meeting.id })
    .from(meeting)
    .innerJoin(meetingSession, eq(meetingSession.meetingId, meeting.id))
    .innerJoin(
      meetingAttendance,
      eq(meetingAttendance.sessionId, meetingSession.id),
    )
    .where(
      and(
        eq(meeting.organiserId, userId),
        ilike(meetingAttendance.participantName, term),
      ),
    )

  const chatMatches = db
    .select({ id: meeting.id })
    .from(meeting)
    .innerJoin(meetingChatMessage, eq(meetingChatMessage.meetingId, meeting.id))
    .where(
      and(
        eq(meeting.organiserId, userId),
        ilike(meetingChatMessage.message, term),
      ),
    )

  return db
    .select()
    .from(meeting)
    .where(
      and(
        eq(meeting.organiserId, userId),
        or(
          ilike(meeting.id, term),
          inArray(meeting.id, attendeeMatches),
          inArray(meeting.id, chatMatches),
        ),
      ),
    )
    .orderBy(desc(meeting.updatedAt))
    .limit(limit)
}

/** Event titles for the user's meetings, for labelling dashboard rows. */
export async function getEventTitlesForMeetings(
  db: Db,
  meetingIds: string[],
): Promise<Record<string, string>> {
  if (meetingIds.length === 0) return {}
  const rows = await db
    .select({
      meetingId: meeting.id,
      title: readonlyCalendarEvents.title,
    })
    .from(meeting)
    .innerJoin(
      readonlyCalendarEvents,
      eq(meeting.eventId, readonlyCalendarEvents.id),
    )
    .where(inArray(meeting.id, meetingIds))
  const out: Record<string, string> = {}
  for (const row of rows) out[row.meetingId] = row.title
  return out
}

/** Attendance and duration for many meetings at once (dashboard list). */
export async function getMeetingSummaries(
  db: Db,
  meetingIds: string[],
): Promise<Record<string, { totalMinutes: number; attendees: number }>> {
  if (meetingIds.length === 0) return {}
  const rows = await db
    .select({
      meetingId: meetingSession.meetingId,
      minutes: sql<number>`coalesce(sum(extract(epoch from (${meetingSession.endedAt} - ${meetingSession.startedAt})) / 60), 0)`,
      attendees: sql<number>`count(distinct ${meetingAttendance.participantIdentity})`,
    })
    .from(meetingSession)
    .leftJoin(
      meetingAttendance,
      eq(meetingAttendance.sessionId, meetingSession.id),
    )
    .where(inArray(meetingSession.meetingId, meetingIds))
    .groupBy(meetingSession.meetingId)

  const out: Record<string, { totalMinutes: number; attendees: number }> = {}
  for (const row of rows) {
    out[row.meetingId] = {
      totalMinutes: Math.round(Number(row.minutes) || 0),
      attendees: Number(row.attendees) || 0,
    }
  }
  return out
}
