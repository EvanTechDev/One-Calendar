import { and, eq, inArray } from 'drizzle-orm'
import { calendarEvents } from '@/lib/drizzle/schema'
import { encryptField, encryptJsonField } from '@/lib/field-crypto'
import {
  parseRfcStamp,
  shiftExdates,
  translateStampsByDays,
  isValidRrule as isSupportedRrule,
} from '@zntr/ui/calendar/lib/recurrence/engine'
import { getDb } from '@/lib/drizzle/client'
import type { InstanceChangePlan } from '@/lib/event-service'

/**
 * The parts of an event write that BOTH write paths have to agree on.
 *
 * There are two of them: the REST handler in `app/api/events/route.ts` and the
 * MCP/agent tools in `lib/mcp/event-tools.ts`. They used to carry private
 * copies of the recurrence validators and of the field encryptor, and those
 * copies had already drifted — the REST one handled `participants` and
 * `emailReminder`, the MCP one did not, so an `updateEvent` through the agent
 * silently dropped participant changes while the web UI applied them.
 *
 * A field being absent from `encryptMergedFields` is not a compile error: the
 * merge is a plain `Record<string, unknown>` and the result is spread into a
 * drizzle `.set()`. That is exactly how the drift stayed invisible, and it is
 * why this module exists rather than a comment asking both sides to be
 * careful.
 */

/**
 * Either the singleton connection or a transaction executor. Helpers that take
 * this can join a caller's transaction unchanged — which the series remap
 * paths need, so that a re-stamped override and the master that displaced it
 * commit or roll back together.
 */
export type EventWriteDb =
  | ReturnType<typeof getDb>
  | Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0]

/**
 * Whether `RRule` can parse `rule`. Absent means "not recurring", so both
 * `null` and `undefined` pass.
 *
 * Validated rather than merely bounded because `expandSeries` swallows a parse
 * failure into an empty occurrence list: an unchecked rule is stored as a
 * series that exists in the database and renders empty everywhere.
 */
export function isValidRrule(rule: string | null | undefined): boolean {
  if (rule === null || rule === undefined) return true
  return isSupportedRrule(rule)
}

/** RFC 5545 stamp: local `YYYYMMDD`, or UTC `YYYYMMDDTHHMMSSZ`. */
export function isValidStamp(stamp: string): boolean {
  try {
    parseRfcStamp(stamp)
    return true
  } catch {
    return false
  }
}

/**
 * Encrypts the merged, decrypted field set on its way back to a row.
 *
 * Encrypting on write and decrypting on read means an update has to decrypt
 * what it is about to overwrite and re-encrypt every field it keeps — a merged
 * object, not a delta. Dates and the enumerated columns pass through
 * untouched; only the three free-text fields and the participants blob are
 * encrypted at rest.
 *
 * A field that is `undefined` is absent from the result, so the caller only
 * writes what it actually merged. `participants` and `emailReminder` belong
 * here: the participants column is an encrypted jsonb, and forgetting it
 * writes the merged set back without the guests.
 */
export function encryptMergedFields(
  rowId: string,
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const encrypted: Record<string, unknown> = {}
  if (fields.title !== undefined)
    encrypted.title = encryptField(rowId, fields.title as string) ?? ''
  if (fields.description !== undefined)
    encrypted.description = encryptField(rowId, fields.description as string)
  if (fields.location !== undefined)
    encrypted.location = encryptField(rowId, fields.location as string)
  if (fields.participants !== undefined)
    encrypted.participants = encryptJsonField(rowId, fields.participants)
  if (fields.startDate !== undefined) encrypted.startDate = fields.startDate
  if (fields.endDate !== undefined) encrypted.endDate = fields.endDate
  if (fields.isAllDay !== undefined) encrypted.isAllDay = fields.isAllDay
  if (fields.status !== undefined) encrypted.status = fields.status
  if (fields.color !== undefined) encrypted.color = fields.color
  if (fields.categoryId !== undefined) encrypted.categoryId = fields.categoryId
  if (fields.notificationMinutes !== undefined)
    encrypted.notificationMinutes = fields.notificationMinutes
  if (fields.emailReminder !== undefined)
    encrypted.emailReminder = fields.emailReminder
  return encrypted
}

/**
 * A conflicting insert must keep the winning row's encryption identity. Never
 * put ciphertext encrypted for the proposed UUID into an existing row. Called
 * inside the same transaction as the master's EXDATE write by both write paths.
 */
export async function writeInstanceOverride(
  db: EventWriteDb,
  userId: string,
  upsert: NonNullable<InstanceChangePlan['overrideUpsert']>,
) {
  let rowId = upsert.id
  if (upsert.isNew) {
    const [inserted] = await db
      .insert(calendarEvents)
      .values({
        id: rowId,
        userId,
        seriesId: upsert.seriesId,
        recurrenceId: upsert.recurrenceId,
        createdAt: upsert.fields.createdAt as Date,
        updatedAt: upsert.fields.updatedAt as Date,
        ...encryptMergedFields(rowId, upsert.fields),
      } as typeof calendarEvents.$inferInsert)
      .onConflictDoNothing({
        target: [calendarEvents.seriesId, calendarEvents.recurrenceId],
      })
      .returning()
    if (inserted) return inserted

    // INSERT waits for the conflicting transaction. This separate statement
    // sees its committed row at PostgreSQL's default READ COMMITTED isolation.
    const [winner] = await db
      .select({ id: calendarEvents.id })
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.seriesId, upsert.seriesId),
          eq(calendarEvents.recurrenceId, upsert.recurrenceId),
          eq(calendarEvents.userId, userId),
        ),
      )
    if (!winner) throw new Error('Override changed during write; retry')
    rowId = winner.id
  }
  const [updated] = await db
    .update(calendarEvents)
    .set({
      ...encryptMergedFields(rowId, upsert.fields),
      updatedAt: new Date(),
    })
    .where(and(eq(calendarEvents.id, rowId), eq(calendarEvents.userId, userId)))
    .returning()
  if (!updated) throw new Error('Override changed during write; retry')
  return updated
}

/** Ids of a series' single-instance overrides. */
export async function fetchOverrideIds(
  db: EventWriteDb,
  seriesId: string,
): Promise<string[]> {
  const rows = await db
    .select({ id: calendarEvents.id })
    .from(calendarEvents)
    .where(eq(calendarEvents.seriesId, seriesId))
  return rows.map((r) => r.id)
}

/**
 * Re-stamps a series' single-instance overrides after the series itself moved.
 *
 * Occurrences are identified by their recurrence stamp, so the stamp has to
 * follow the series into its new clock (and day) space for each override to
 * keep matching. Stored start/end times are deliberately left alone: an
 * instance the user edited on its own — a Wednesday moved to 14:00 — keeps
 * that time. Without the remap the override matches no generated occurrence
 * and resurfaces as an orphan duplicate, which is the failure the call sites
 * describe.
 *
 * @param clockSource the series' NEW anchor — a clock source, not a delta.
 *   Measuring a delta from the old anchor shifted carried grants by the
 *   distance between the two anchors rather than by the intended move.
 * @param dayDelta the whole-pattern day distance for a cross-day move; `0` for
 *   a pure clock change, which keeps every override on its own day.
 *
 * Pass the caller's transaction: this runs once per override, and a partial
 * pass would leave the series and its overrides disagreeing about where the
 * occurrences are.
 */
export async function shiftOverrideStamps(
  db: EventWriteDb,
  userId: string,
  ids: string[],
  clockSource: Date,
  timeZone?: string,
  dayDelta = 0,
): Promise<void> {
  if (ids.length === 0) return
  const rows = await db
    .select({
      id: calendarEvents.id,
      recurrenceId: calendarEvents.recurrenceId,
    })
    .from(calendarEvents)
    .where(
      and(inArray(calendarEvents.id, ids), eq(calendarEvents.userId, userId)),
    )
  for (const row of rows) {
    if (!row.recurrenceId) continue
    const newStamp =
      dayDelta !== 0
        ? translateStampsByDays(
            [row.recurrenceId],
            dayDelta,
            clockSource,
            timeZone,
          )![0]
        : shiftExdates([row.recurrenceId], clockSource, timeZone)![0]
    await db
      .update(calendarEvents)
      .set({
        recurrenceId: newStamp,
        updatedAt: new Date(),
      })
      .where(
        and(eq(calendarEvents.id, row.id), eq(calendarEvents.userId, userId)),
      )
  }
}

/**
 * {@link shiftOverrideStamps} for a whole series: every override the series
 * currently has.
 */
export async function remapSeriesOverrideStamps(
  db: EventWriteDb,
  userId: string,
  seriesId: string,
  clockSource: Date,
  timeZone?: string,
  dayDelta = 0,
): Promise<void> {
  await shiftOverrideStamps(
    db,
    userId,
    await fetchOverrideIds(db, seriesId),
    clockSource,
    timeZone,
    dayDelta,
  )
}
