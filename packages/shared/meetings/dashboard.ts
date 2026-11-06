import { and, desc, eq, ilike, inArray, or } from 'drizzle-orm'
import {
  meeting,
  meetingAttendance,
  meetingChatMessage,
  meetingSession,
} from './schema'
import { readonlyCalendarEvents } from './readonly-calendar'
import type { Meeting } from './schema'
import type { Db } from './db'

/**
 * Escapes the LIKE metacharacters so a search term is matched literally.
 *
 * Unescaped, a query of `%` matched every row the user owns, and `_` matched
 * any single character — a search box that quietly ignores what you typed.
 * The backslash must go first, or it would double-escape the escapes added
 * after it.
 */
function escapeLikeTerm(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/[%_]/g, (c) => `\\${c}`)
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
  const trimmed = query.trim()
  if (trimmed.length === 0) return []
  const term = `%${escapeLikeTerm(trimmed)}%`

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

export interface MeetingEventContext {
  eventId: string
  title: string
  startDate: Date
  endDate: Date
  /**
   * True when the event is a Series. Its `startDate` is then the recurrence
   * anchor rather than this sitting's time, so a caller must not present it as
   * "when this meeting is".
   */
  isSeries: boolean
}

/**
 * The calendar event a Meeting belongs to, for showing context inside the
 * room — a participant should see "Q3 budget review, 14:00" rather than a
 * room code.
 *
 * Read in-process through the read-only events description (ADR-0020), which
 * ADR-0017 prefers over a network hop on a shared database. No recurrence
 * expansion happens here and none is needed: the room asks *which event is
 * this*, not *which occurrences fall in a window*. The title is still
 * encrypted at rest — the caller decrypts it.
 */
export async function getEventContextForMeeting(
  db: Db,
  meetingId: string,
): Promise<MeetingEventContext | null> {
  const rows = await db
    .select({
      eventId: readonlyCalendarEvents.id,
      title: readonlyCalendarEvents.title,
      startDate: readonlyCalendarEvents.startDate,
      endDate: readonlyCalendarEvents.endDate,
      rrule: readonlyCalendarEvents.rrule,
    })
    .from(meeting)
    .innerJoin(
      readonlyCalendarEvents,
      eq(meeting.eventId, readonlyCalendarEvents.id),
    )
    .where(eq(meeting.id, meetingId))
    .limit(1)

  const row = rows[0]
  if (!row) return null
  return {
    eventId: row.eventId,
    title: row.title,
    startDate: row.startDate,
    endDate: row.endDate,
    isSeries: Boolean(row.rrule && row.rrule.trim().length > 0),
  }
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

/**
 * Attendance and duration for many meetings at once (dashboard list).
 *
 * Two flat queries aggregated in application code rather than one grouped join.
 * The join version summed session durations across the joined attendance rows,
 * so a 60-minute sitting with three attendees reported 180 minutes — the
 * classic fan-out. Keeping the aggregation here also makes it obvious that an
 * OPEN sitting contributes attendees but no duration: an unfinished meeting has
 * no length yet, and guessing one (now − started) would report a number that
 * changes every time the page is refreshed.
 */
export async function getMeetingSummaries(
  db: Db,
  meetingIds: string[],
): Promise<Record<string, { totalMinutes: number; attendees: number }>> {
  if (meetingIds.length === 0) return {}

  const sessions: {
    id: string
    meetingId: string
    startedAt: Date
    endedAt: Date | null
  }[] = await db
    .select({
      id: meetingSession.id,
      meetingId: meetingSession.meetingId,
      startedAt: meetingSession.startedAt,
      endedAt: meetingSession.endedAt,
    })
    .from(meetingSession)
    .where(inArray(meetingSession.meetingId, meetingIds))

  const out: Record<string, { totalMinutes: number; attendees: number }> = {}
  if (sessions.length === 0) return out

  const attendance: { sessionId: string; participantIdentity: string }[] =
    await db
      .select({
        sessionId: meetingAttendance.sessionId,
        participantIdentity: meetingAttendance.participantIdentity,
      })
      .from(meetingAttendance)
      .where(
        inArray(
          meetingAttendance.sessionId,
          sessions.map((session) => session.id),
        ),
      )

  const meetingOfSession = new Map(sessions.map((s) => [s.id, s.meetingId]))
  /** Distinct participants per meeting — the same person across two sittings counts once. */
  const identities = new Map<string, Set<string>>()
  for (const row of attendance) {
    const meetingId = meetingOfSession.get(row.sessionId)
    if (!meetingId) continue
    const set = identities.get(meetingId) ?? new Set<string>()
    set.add(row.participantIdentity)
    identities.set(meetingId, set)
  }

  for (const session of sessions) {
    const entry = out[session.meetingId] ?? { totalMinutes: 0, attendees: 0 }
    if (session.endedAt) {
      entry.totalMinutes += Math.max(
        0,
        Math.round(
          (session.endedAt.getTime() - session.startedAt.getTime()) / 60000,
        ),
      )
    }
    out[session.meetingId] = entry
  }
  for (const [meetingId, set] of identities) {
    const entry = out[meetingId]
    if (entry) entry.attendees = set.size
  }
  return out
}
