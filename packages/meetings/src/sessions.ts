import { randomUUID } from 'node:crypto'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { meetingAttendance, meetingChatMessage, meetingSession } from './schema'
import type {
  MeetingAttendance,
  MeetingChatMessage,
  MeetingSession,
} from './schema'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

/**
 * Sessions and Attendance are written from the media server's webhooks, never
 * from clients (ADR 0020) — a client-reported duration is a number the server
 * cannot check.
 *
 * Webhook deliveries retry and can arrive out of order, so every operation
 * here is idempotent or self-healing: opening a session twice yields one row,
 * and a join whose room_started never arrived opens the session it needs.
 */

/** The open sitting for a meeting, if one is in progress. */
export async function getOpenSession(
  db: Db,
  meetingId: string,
): Promise<MeetingSession | null> {
  const rows = await db
    .select()
    .from(meetingSession)
    .where(
      and(
        eq(meetingSession.meetingId, meetingId),
        isNull(meetingSession.endedAt),
      ),
    )
    .orderBy(desc(meetingSession.startedAt))
    .limit(1)
  return rows[0] ?? null
}

/**
 * Opens a sitting, reusing the open one when it already exists. `id` comes
 * from the media server's room sid where available, so a retried delivery
 * lands on the same row.
 */
export async function openSession(
  db: Db,
  input: { id?: string; meetingId: string; startedAt: Date },
): Promise<MeetingSession> {
  const existing = await getOpenSession(db, input.meetingId)
  if (existing) return existing
  const [row] = await db
    .insert(meetingSession)
    .values({
      id: input.id ?? randomUUID(),
      meetingId: input.meetingId,
      startedAt: input.startedAt,
    })
    .onConflictDoNothing()
    .returning()
  // A concurrent delivery may have won the insert.
  return row ?? (await getOpenSession(db, input.meetingId))!
}

export async function closeSession(
  db: Db,
  meetingId: string,
  endedAt: Date,
): Promise<void> {
  const open = await getOpenSession(db, meetingId)
  if (!open) return
  await db
    .update(meetingSession)
    .set({ endedAt })
    .where(eq(meetingSession.id, open.id))
}

/**
 * Records a participant joining. A second delivery for a participant already
 * present is ignored rather than duplicated.
 */
export async function recordJoin(
  db: Db,
  input: {
    sessionId: string
    participantIdentity: string
    participantName: string
    joinedAt: Date
  },
): Promise<void> {
  const open = await db
    .select()
    .from(meetingAttendance)
    .where(
      and(
        eq(meetingAttendance.sessionId, input.sessionId),
        eq(meetingAttendance.participantIdentity, input.participantIdentity),
        isNull(meetingAttendance.leftAt),
      ),
    )
    .limit(1)
  if (open.length > 0) return

  await db.insert(meetingAttendance).values({
    id: randomUUID(),
    sessionId: input.sessionId,
    participantIdentity: input.participantIdentity,
    participantName: input.participantName,
    joinedAt: input.joinedAt,
  })
}

export async function recordLeave(
  db: Db,
  input: { sessionId: string; participantIdentity: string; leftAt: Date },
): Promise<void> {
  const rows = await db
    .select()
    .from(meetingAttendance)
    .where(
      and(
        eq(meetingAttendance.sessionId, input.sessionId),
        eq(meetingAttendance.participantIdentity, input.participantIdentity),
        isNull(meetingAttendance.leftAt),
      ),
    )
    .limit(1)
  const row = rows[0]
  if (!row) return
  await db
    .update(meetingAttendance)
    .set({ leftAt: input.leftAt })
    .where(eq(meetingAttendance.id, row.id))
}

/** Closes any attendance still open on a finished sitting. */
export async function closeOpenAttendance(
  db: Db,
  sessionId: string,
  leftAt: Date,
): Promise<void> {
  await db
    .update(meetingAttendance)
    .set({ leftAt })
    .where(
      and(
        eq(meetingAttendance.sessionId, sessionId),
        isNull(meetingAttendance.leftAt),
      ),
    )
}

export async function listAttendance(
  db: Db,
  sessionId: string,
): Promise<MeetingAttendance[]> {
  return db
    .select()
    .from(meetingAttendance)
    .where(eq(meetingAttendance.sessionId, sessionId))
    .orderBy(meetingAttendance.joinedAt)
}

export async function listSessions(
  db: Db,
  meetingId: string,
): Promise<MeetingSession[]> {
  return db
    .select()
    .from(meetingSession)
    .where(eq(meetingSession.meetingId, meetingId))
    .orderBy(desc(meetingSession.startedAt))
}

/**
 * Retained Chat: only meetings without end-to-end encryption ever reach
 * here, because an encrypted room's messages never leave the client in
 * readable form (ADR 0020).
 */
export async function retainChatMessage(
  db: Db,
  input: {
    meetingId: string
    sessionId?: string | null
    senderIdentity: string
    senderName: string
    message: string
    sentAt?: Date
  },
): Promise<void> {
  await db.insert(meetingChatMessage).values({
    id: randomUUID(),
    meetingId: input.meetingId,
    sessionId: input.sessionId ?? null,
    senderIdentity: input.senderIdentity,
    senderName: input.senderName,
    message: input.message,
    sentAt: input.sentAt ?? new Date(),
  })
}

export async function listChatMessages(
  db: Db,
  meetingId: string,
): Promise<MeetingChatMessage[]> {
  return db
    .select()
    .from(meetingChatMessage)
    .where(eq(meetingChatMessage.meetingId, meetingId))
    .orderBy(meetingChatMessage.sentAt)
}
