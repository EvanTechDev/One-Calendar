import { and, asc, eq, gt, inArray, or } from 'drizzle-orm'
import { getDb } from './drizzle/client'
import { calendarEvents, eventInvites, settings } from './drizzle/schema'
import { decryptEvent } from './api-helpers'
import { baselineOf, getOccurrencesForInvites } from './invites/invite-service'
import { canParticipantSeeOccurrence } from './invites/visibility'
import {
  buildInstanceId,
  expandSeries,
  parseRfcStamp,
} from './recurrence/engine'
import type { EventSearchHit } from './api-client'

/** Ciphertext cannot be searched with SQL LIKE. Scan bounded keyset pages,
 * decrypt only this page, and let the client continue until the scan is done.
 * Series are represented once, overrides separately; never expand infinity. */
export async function searchEventPage(
  user: { id: string; email: string },
  text: string,
  after: string | null,
  categories: string[],
  signal: AbortSignal,
): Promise<{ results: EventSearchHit[]; cursor: string | null }> {
  const db = getDb()
  const grants = await db
    .select()
    .from(eventInvites)
    .where(
      and(
        eq(eventInvites.email, user.email.toLowerCase()),
        eq(eventInvites.addedToCalendar, true),
      ),
    )
  const grantById = new Map(grants.map((grant) => [grant.eventId, grant]))
  const sharedIds = [...grantById.keys()]
  const rows = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        or(
          eq(calendarEvents.userId, user.id),
          ...(sharedIds.length
            ? [
                inArray(calendarEvents.id, sharedIds),
                inArray(calendarEvents.seriesId, sharedIds),
              ]
            : []),
        ),
        after ? gt(calendarEvents.id, after) : undefined,
      ),
    )
    .orderBy(asc(calendarEvents.id))
    .limit(200)
  const [exceptions, zones] = await Promise.all([
    getOccurrencesForInvites(grants.map((grant) => grant.id)),
    db
      .select()
      .from(settings)
      .where(
        inArray(settings.userId, [...new Set(rows.map((row) => row.userId))]),
      ),
  ])
  const ownCategories = new Set(categories)
  const timezone = new Map(
    zones.map((row) => [
      row.userId,
      (row.data as { timezone?: string })?.timezone ?? 'UTC',
    ]),
  )
  const keyword = text.trim().toLocaleLowerCase()
  const results: EventSearchHit[] = []
  let cursor: string | null = null
  for (const row of rows) {
    signal.throwIfAborted()
    cursor = row.id
    const shared = row.userId !== user.id
    const grant = shared ? grantById.get(row.seriesId ?? row.id) : undefined
    if (shared && !grant) continue
    const category = grant?.categoryId ?? row.categoryId
    if (
      ownCategories.size &&
      !ownCategories.has(category ?? '__uncategorized__')
    )
      continue
    const overrides = grant ? (exceptions.get(grant.id) ?? []) : []
    if (
      grant &&
      row.recurrenceId &&
      !canParticipantSeeOccurrence(
        baselineOf(grant),
        overrides,
        row.recurrenceId,
      )
    )
      continue
    const event = decryptEvent(row)
    if (
      ![event.title, event.description, event.location].some((value) =>
        value?.toLocaleLowerCase().includes(keyword),
      )
    )
      continue
    let id =
      event.seriesId && event.recurrenceId
        ? buildInstanceId(event.seriesId, event.recurrenceId)
        : event.id
    let start = event.startDate
    let end = event.endDate
    if (event.rrule && !event.seriesId) {
      // Exclude hidden occurrences before selecting the representative. Explicit
      // grants outside a baseline are checked independently below.
      const excluded = [
        ...(event.exdate ?? []),
        ...overrides.filter((e) => !e.visible).map((e) => e.recurrenceId),
      ]
      const series = { ...event, exdate: excluded }
      let first: ReturnType<typeof expandSeries>[number] | undefined
      if (!grant || grant.baselineKind !== 'none') {
        const lower = grant?.fromStamp
          ? parseRfcStamp(grant.fromStamp).date
          : start
        const upper = grant?.untilStamp
          ? new Date(parseRfcStamp(grant.untilStamp).date.getTime() - 1)
          : new Date(
              Date.UTC(Math.min(start.getUTCFullYear() + 100, 9998), 11, 31),
            )
        first = expandSeries(
          series,
          lower,
          upper,
          1,
          timezone.get(row.userId),
        )[0]
      }
      for (const exception of overrides.filter((e) => e.visible)) {
        const date = parseRfcStamp(exception.recurrenceId).date
        const candidate = expandSeries(
          series,
          new Date(date.getTime() - 86400000),
          new Date(date.getTime() + 86400000),
          3,
          timezone.get(row.userId),
        ).find((e) => e.recurrenceId === exception.recurrenceId)
        if (candidate && (!first || candidate.startDate < first.startDate))
          first = candidate
      }
      if (!first) continue
      id = first.id
      start = first.startDate
      end = first.endDate
    }
    results.push({
      id,
      title: event.title,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      isAllDay: event.isAllDay,
      location: event.location,
      color: event.color,
    })
    if (results.length === 30) return { results, cursor }
  }
  return { results, cursor: rows.length === 200 ? cursor : null }
}
