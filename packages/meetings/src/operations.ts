import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { and, desc, eq, inArray, isNotNull, lt } from 'drizzle-orm'
import { meeting } from './schema'
import type { Meeting } from './schema'
import type { Db } from './db'
import { closeOpenAttendance, closeSession } from './sessions'

const ROOM_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

/**
 * Largest multiple of the alphabet size that fits in a byte (252 for 36).
 * Bytes at or above it are discarded rather than folded with `%`, which would
 * make indices 0–3 about 14% likelier than the rest. The room code IS the join
 * credential (holding the link is sufficient to join, ADR 0019), so its
 * entropy is a security property, not a cosmetic one.
 */
const REJECTION_CEILING =
  Math.floor(256 / ROOM_ID_ALPHABET.length) * ROOM_ID_ALPHABET.length

function randomChars(length: number): string {
  let out = ''
  while (out.length < length) {
    // Over-draw so the common case needs one syscall: at 36 symbols only
    // 4/256 bytes are rejected.
    const bytes = randomBytes((length - out.length) * 2)
    for (const byte of bytes) {
      if (byte >= REJECTION_CEILING) continue
      out += ROOM_ID_ALPHABET[byte % ROOM_ID_ALPHABET.length]
      if (out.length === length) break
    }
  }
  return out
}

/** Generates a Meeting id / room code: `xxxx-xxxx` (ADR 0019). */
export function generateMeetingId(): string {
  return `${randomChars(4)}-${randomChars(4)}`
}

/** Generates a raw Creator Token for a guest Organiser (ADR 0016). */
export function generateCreatorToken(): string {
  return randomChars(48)
}

/** SHA-256 hex of a Creator Token, the form stored on the Meeting row. */
export function hashCreatorToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

/**
 * Constant-time comparison of a presented Creator Token against the
 * stored hash. False for missing values.
 */
export function verifyCreatorToken(
  rawToken: string | null | undefined,
  storedHash: string | null | undefined,
): boolean {
  if (!rawToken || !storedHash) return false
  const presented = Buffer.from(hashCreatorToken(rawToken), 'hex')
  const stored = Buffer.from(storedHash, 'hex')
  if (presented.length !== stored.length) return false
  return timingSafeEqual(presented, stored)
}

export interface CreateMeetingInput {
  id: string
  organiserId?: string | null
  creatorTokenHash?: string | null
  eventId?: string | null
  expiresAt?: Date | null
}

export async function createMeeting(
  db: Db,
  input: CreateMeetingInput,
): Promise<Meeting> {
  const [row] = await db
    .insert(meeting)
    .values({
      id: input.id,
      organiserId: input.organiserId ?? null,
      creatorTokenHash: input.creatorTokenHash ?? null,
      eventId: input.eventId ?? null,
      expiresAt: input.expiresAt ?? null,
    })
    .returning()
  return row
}

export async function getMeeting(db: Db, id: string): Promise<Meeting | null> {
  const rows = await db.select().from(meeting).where(eq(meeting.id, id))
  return rows[0] ?? null
}

export async function getMeetingForEvent(
  db: Db,
  eventId: string,
): Promise<Meeting | null> {
  const rows = await db
    .select()
    .from(meeting)
    .where(eq(meeting.eventId, eventId))
  return rows[0] ?? null
}

/**
 * The same lookup for many events in one statement, keyed by event id.
 *
 * Event surfaces used to resolve their Meeting one HTTP round trip at a time,
 * which is what made the link appear a beat after the rest of the event. The
 * calendar's list query decorates every row from this instead.
 */
export async function getMeetingsForEvents(
  db: Db,
  eventIds: string[],
): Promise<Map<string, Meeting>> {
  const out = new Map<string, Meeting>()
  if (eventIds.length === 0) return out
  const rows: Meeting[] = await db
    .select()
    .from(meeting)
    .where(inArray(meeting.eventId, eventIds))
  for (const row of rows) {
    if (row.eventId !== null) out.set(row.eventId, row)
  }
  return out
}

/**
 * Promotes a provisional Meeting into a committed Event Meeting.
 *
 * A Meeting created from the event editor exists before its event row does —
 * the organiser wants a copyable link the moment they click "Add Zentra Meet",
 * as Google Calendar gives them. Until the event is saved the row is provisional
 * and carries an `expiresAt`, so the abandoned ones are swept like any other
 * expired row. Saving the event is what makes it a real Event Meeting, whose
 * lifecycle is the event's and which therefore has no independent expiry
 * (ADR 0018).
 *
 * Scoped to the organiser, and to rows that are still provisional. Event ids are
 * client-chosen, so without the organiser predicate a provisional row planted
 * against an id someone else later happened to create would be silently adopted
 * by their event.
 */
export async function commitMeetingForEvent(
  db: Db,
  eventId: string,
  organiserId: string,
): Promise<void> {
  await db
    .update(meeting)
    .set({ expiresAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(meeting.eventId, eventId),
        eq(meeting.organiserId, organiserId),
        isNotNull(meeting.expiresAt),
      ),
    )
}

/**
 * Deletes a Meeting for an event ONLY while it is still provisional.
 *
 * The `expiresAt IS NOT NULL` predicate is the whole point, and it lives in the
 * statement rather than in a caller's `if`: this runs when the event editor is
 * dismissed, and the editor cannot always tell a draft from an existing event
 * (a draft saved mid-session is both). A committed Event Meeting belongs to a
 * saved event, and deleting it would destroy a link participants already hold —
 * so the database refuses rather than trusting the caller to have checked.
 *
 * Returns the ids actually removed, so a caller can tell "nothing to do" from
 * "refused".
 */
export async function deleteProvisionalMeetingForEvent(
  db: Db,
  eventId: string,
  organiserId: string,
): Promise<string[]> {
  const rows: Meeting[] = await db
    .delete(meeting)
    .where(
      and(
        eq(meeting.eventId, eventId),
        eq(meeting.organiserId, organiserId),
        isNotNull(meeting.expiresAt),
      ),
    )
    .returning()
  return rows.map((row) => row.id)
}

/**
 * A Meeting accepts joins when it has not been Ended and has not expired.
 * The link's validity lives here; the live room instance is the media
 * server's concern (ADR 0016/0019 — two separate layers).
 */
export function isJoinable(row: Meeting, now: Date = new Date()): boolean {
  if (row.endedAt !== null) return false
  if (row.expiresAt !== null && row.expiresAt <= now) return false
  return true
}

/**
 * End Meeting: the Organiser's explicit act (ADR 0016).
 *
 * The open sitting is closed here rather than left to the media server's
 * `room_finished` webhook. That webhook only fires if `deleteRoom` succeeds,
 * and the caller swallows its failure (a room that was never live is not an
 * error) — so an ended meeting could keep a sitting open forever, leaving its
 * duration null and the dashboard reporting 0 min. Closing it twice is
 * harmless; never closing it is not.
 */
export async function endMeeting(db: Db, id: string): Promise<void> {
  const now = new Date()
  await db
    .update(meeting)
    .set({ endedAt: now, updatedAt: now })
    .where(eq(meeting.id, id))
  const closed = await closeSession(db, id, now)
  if (closed) await closeOpenAttendance(db, closed.id, now)
}

/** Reopen an ended Meeting — the link never changed (ADR 0019). */
export async function reopenMeeting(db: Db, id: string): Promise<void> {
  await db
    .update(meeting)
    .set({ endedAt: null, updatedAt: new Date() })
    .where(eq(meeting.id, id))
}

export async function deleteMeeting(db: Db, id: string): Promise<void> {
  await db.delete(meeting).where(eq(meeting.id, id))
}

/**
 * Application-level cascade (ADR 0017): the calendar's event-deletion
 * path calls this. There is deliberately no database FK.
 */
export async function deleteMeetingsForEvent(
  db: Db,
  eventId: string,
): Promise<void> {
  await db.delete(meeting).where(eq(meeting.eventId, eventId))
}

/**
 * The same cascade for many event rows in one statement. Deleting a series
 * meant one statement per row (51 for a 50-override series) even though
 * meetings only ever attach to masters. Mirrors the adjacent `eventInvites`
 * delete, which already batches with `inArray`.
 */
export async function deleteMeetingsForEvents(
  db: Db,
  eventIds: string[],
): Promise<void> {
  if (eventIds.length === 0) return
  await db.delete(meeting).where(inArray(meeting.eventId, eventIds))
}

/**
 * Removes every Meeting a user organised — the account-deletion cascade.
 *
 * Without this, deleting an account left never-expiring, still-joinable rooms
 * behind whose `organiserId` pointed at a user that no longer exists. Nobody
 * could ever End them: `isOrganiser` needs either that user's session (gone
 * forever) or a Creator Token (null for signed-in Organisers).
 */
export async function deleteMeetingsForOrganiser(
  db: Db,
  organiserId: string,
): Promise<void> {
  await db.delete(meeting).where(eq(meeting.organiserId, organiserId))
}

/**
 * Re-point a Meeting at a new event row — used when a series split
 * creates a new master (mirrors how invites survive splits, ADR 0009).
 */
export async function moveMeetingToEvent(
  db: Db,
  fromEventId: string,
  toEventId: string,
): Promise<void> {
  await db
    .update(meeting)
    .set({ eventId: toEventId, updatedAt: new Date() })
    .where(eq(meeting.eventId, fromEventId))
}

/** Recent meetings the user organised, newest first (dashboard). */
export async function listRecentMeetings(
  db: Db,
  organiserId: string,
  limit = 20,
): Promise<Meeting[]> {
  return db
    .select()
    .from(meeting)
    .where(eq(meeting.organiserId, organiserId))
    .orderBy(desc(meeting.updatedAt))
    .limit(limit)
}

/**
 * Removes expired guest Meetings (ADR 0018). Returns the deleted rows'
 * ids. Only guest meetings carry an expiry, so no owner filter is needed.
 */
export async function deleteExpiredMeetings(
  db: Db,
  now: Date = new Date(),
): Promise<string[]> {
  const rows: Meeting[] = await db
    .delete(meeting)
    .where(lt(meeting.expiresAt, now))
    .returning()
  return rows.map((row) => row.id)
}
