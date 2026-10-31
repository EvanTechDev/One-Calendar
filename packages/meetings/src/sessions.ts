import { randomUUID } from 'node:crypto'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { meetingAttendance, meetingChatMessage, meetingSession } from './schema'
import type { MeetingSession } from './schema'
import type { Db } from './db'

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

/** One sitting by id, open or closed. */
export async function getSession(
  db: Db,
  id: string,
): Promise<MeetingSession | null> {
  const rows = await db
    .select()
    .from(meetingSession)
    .where(eq(meetingSession.id, id))
    .limit(1)
  return rows[0] ?? null
}

/**
 * Opens a sitting, identified strictly by the media server's room `sid`.
 *
 * The sid IS the sitting's identity. Reusing "whatever open session this
 * meeting has" instead merged two distinct sittings into one: a room left
 * idle overnight and rejoined the next morning counted the whole night as
 * one meeting, because the stale open row was adopted rather than a new one
 * opened.
 *
 * Returns null when the row cannot be produced — which happens when the sid
 * exists but is already CLOSED. The previous code laundered that case through
 * a `!`, so the webhook handler dereferenced null, 500'd, and LiveKit retried
 * the same undeliverable event forever, stalling all attendance recording.
 * A caller seeing null must treat the event as final and unprocessable.
 */
export async function openSession(
  db: Db,
  input: { id?: string; meetingId: string; startedAt: Date },
): Promise<MeetingSession | null> {
  const id = input.id
  if (id) {
    const existing = await getSession(db, id)
    // Already closed: this delivery is late and there is nothing to reopen.
    // Ending a sitting is final.
    if (existing) return existing.endedAt === null ? existing : null
  } else {
    // No sid (shouldn't happen for room events, but the SDK types allow it):
    // fall back to the meeting's open sitting so a join is still recorded.
    const open = await getOpenSession(db, input.meetingId)
    if (open) return open
  }

  const [row] = await db
    .insert(meetingSession)
    .values({
      id: id ?? randomUUID(),
      meetingId: input.meetingId,
      startedAt: input.startedAt,
    })
    .onConflictDoNothing()
    .returning()
  if (row) return row

  // A concurrent delivery won the insert. Re-read by id rather than "the open
  // one" — the winner may already have closed it.
  if (!id) return getOpenSession(db, input.meetingId)
  const raced = await getSession(db, id)
  if (!raced) return null
  return raced.endedAt === null ? raced : null
}

/**
 * Closes one sitting by id, creating it first when the sid is unknown.
 *
 * `room_finished` can arrive before `room_started` (webhook deliveries are
 * retried independently and not ordered). Previously an unknown sid was
 * ignored, so the later `room_started` opened a sitting nothing would ever
 * close — its duration stayed null forever and the dashboard reported 0 min.
 * Creating-then-closing makes the out-of-order case self-heal.
 */
export async function closeSessionById(
  db: Db,
  input: { id: string; meetingId: string; endedAt: Date },
): Promise<MeetingSession | null> {
  const existing = await getSession(db, input.id)
  if (!existing) {
    // Started and finished are the same instant as far as we can tell: the
    // start we never received is not recoverable, and inventing an earlier
    // one would fabricate a duration.
    await db
      .insert(meetingSession)
      .values({
        id: input.id,
        meetingId: input.meetingId,
        startedAt: input.endedAt,
        endedAt: input.endedAt,
      })
      .onConflictDoNothing()
    return getSession(db, input.id)
  }
  if (existing.endedAt !== null) return existing
  await db
    .update(meetingSession)
    .set({ endedAt: input.endedAt })
    .where(eq(meetingSession.id, input.id))
  return { ...existing, endedAt: input.endedAt }
}

/**
 * Closes a meeting's open sitting, whatever its id. Used by End Meeting,
 * which has no room sid to work with.
 */
export async function closeSession(
  db: Db,
  meetingId: string,
  endedAt: Date,
): Promise<MeetingSession | null> {
  const open = await getOpenSession(db, meetingId)
  if (!open) return null
  await db
    .update(meetingSession)
    .set({ endedAt })
    .where(eq(meetingSession.id, open.id))
  return { ...open, endedAt }
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
