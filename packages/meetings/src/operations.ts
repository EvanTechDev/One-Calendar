import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { desc, eq, lt } from 'drizzle-orm'
import { meeting } from './schema'
import type { Meeting } from './schema'

/**
 * Any drizzle postgres-js database handle. The operations are
 * connection-agnostic: each app passes its own client.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

const ROOM_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

function randomChars(length: number): string {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ROOM_ID_ALPHABET[bytes[i] % ROOM_ID_ALPHABET.length]
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
 * A Meeting accepts joins when it has not been Ended and has not expired.
 * The link's validity lives here; the live room instance is the media
 * server's concern (ADR 0016/0019 — two separate layers).
 */
export function isJoinable(row: Meeting, now: Date = new Date()): boolean {
  if (row.endedAt !== null) return false
  if (row.expiresAt !== null && row.expiresAt <= now) return false
  return true
}

/** End Meeting: the Organiser's explicit act (ADR 0016). */
export async function endMeeting(db: Db, id: string): Promise<void> {
  await db
    .update(meeting)
    .set({ endedAt: new Date(), updatedAt: new Date() })
    .where(eq(meeting.id, id))
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
