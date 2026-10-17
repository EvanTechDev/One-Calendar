import {
  and,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  desc,
} from 'drizzle-orm'
import { getDb } from '@/lib/drizzle/client'
import {
  calendarEvents,
  eventInvites,
  settings,
  user,
} from '@/lib/drizzle/schema'
import { decryptEvent } from '@/lib/api-helpers'
import {
  defaultExpansionWindow,
  describeRecurrence,
  expandSeriesViewInRange,
  type SeriesViewInput,
} from '@zntr/ui/calendar/lib/recurrence/engine'
import {
  baselineOf,
  getOccurrencesForInvites,
} from '@/lib/invites/invite-service'
import { canParticipantSeeOccurrence } from '@/lib/invites/visibility'

type Event = ReturnType<typeof decryptEvent>
type EventWindow = { windowStart: Date; windowEnd: Date }
type Viewer = { id: string; email: string }

export type ViewEvent = Event & {
  instanceId?: string
  viewOnly?: boolean
  organizer?: { name: string; email: string; image: string | null } | null
}

function overlaps(window: EventWindow) {
  return and(
    lt(calendarEvents.startDate, window.windowEnd),
    gt(calendarEvents.endDate, window.windowStart),
  )
}

function inWindow(event: Event, window: EventWindow) {
  return (
    event.startDate < window.windowEnd && event.endDate > window.windowStart
  )
}

/**
 * Read each owned row once. Keep all masters and overrides: an override can
 * move into OR out of this window, and its original stamp still suppresses the
 * generated slot. Filtering either only by its stored dates loses that fact.
 */
async function ownedEvents(
  viewerId: string,
  window: EventWindow,
  legacy: boolean,
) {
  const db = getDb()
  const recurring = or(
    isNotNull(calendarEvents.rrule),
    isNotNull(calendarEvents.seriesId),
  )
  if (!legacy) {
    return db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.userId, viewerId),
          or(recurring, overlaps(window)),
        ),
      )
  }
  // Preserve the no-range endpoint's historical plain-event contract without
  // imposing its 1000-row limit on recurring masters/overrides.
  const [plain, series] = await Promise.all([
    db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.userId, viewerId),
          isNull(calendarEvents.rrule),
          isNull(calendarEvents.seriesId),
        ),
      )
      .orderBy(desc(calendarEvents.startDate))
      .limit(1000),
    db
      .select()
      .from(calendarEvents)
      .where(and(eq(calendarEvents.userId, viewerId), recurring)),
  ])
  return [...plain, ...series]
}

/** A targeted read still passes through permanent-grant and occurrence checks. */
export async function getSharedEvents(
  viewer: { email: string },
  window?: EventWindow,
  eventId?: string,
): Promise<ViewEvent[]> {
  const db = getDb()
  // Expiration bounds the email link, NOT a permanent added-to-calendar grant.
  const grants = await db
    .select()
    .from(eventInvites)
    .where(
      and(
        eq(eventInvites.email, viewer.email.toLowerCase()),
        eq(eventInvites.addedToCalendar, true),
        eventId ? eq(eventInvites.eventId, eventId) : undefined,
      ),
    )
  if (grants.length === 0) return []
  const grantByEvent = new Map(grants.map((grant) => [grant.eventId, grant]))
  const [rows, exceptions] = await Promise.all([
    db
      .select()
      .from(calendarEvents)
      .where(
        and(
          inArray(calendarEvents.id, [...grantByEvent.keys()]),
          window
            ? or(isNotNull(calendarEvents.rrule), overlaps(window))
            : undefined,
        ),
      ),
    getOccurrencesForInvites(grants.map((grant) => grant.id)),
  ])
  if (rows.length === 0) return []

  const ownerIds = [...new Set(rows.map((row) => row.userId))]
  const seriesIds = rows
    .filter((row) => !!row.rrule?.trim())
    .map((row) => row.id)
  const [owners, zones, overrides] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      })
      .from(user)
      .where(inArray(user.id, ownerIds)),
    seriesIds.length
      ? db
          .select({ userId: settings.userId, data: settings.data })
          .from(settings)
          .where(inArray(settings.userId, ownerIds))
      : [],
    seriesIds.length
      ? db
          .select()
          .from(calendarEvents)
          .where(inArray(calendarEvents.seriesId, seriesIds))
      : [],
  ])
  const ownerMap = new Map(owners.map((owner) => [owner.id, owner]))
  const zoneMap = new Map(
    zones.map((row) => {
      const tz = (row.data as { timezone?: unknown } | null)?.timezone
      return [
        row.userId,
        typeof tz === 'string' && tz ? tz : undefined,
      ] as const
    }),
  )
  const overridesBySeries = new Map<string, SeriesViewInput[]>()
  for (const row of overrides) {
    if (!row.seriesId) continue
    const list = overridesBySeries.get(row.seriesId) ?? []
    list.push(decryptEvent(row) as SeriesViewInput)
    overridesBySeries.set(row.seriesId, list)
  }
  const expansion = window ?? defaultExpansionWindow()
  const result: ViewEvent[] = []
  for (const row of rows) {
    const grant = grantByEvent.get(row.id)!
    const owner = ownerMap.get(row.userId)
    const organizer = owner
      ? { name: owner.name, email: owner.email, image: owner.image }
      : null
    const categoryId = grant.categoryId ?? row.categoryId
    const event = decryptEvent(row)
    if (!row.rrule?.trim()) {
      result.push({ ...event, categoryId, viewOnly: true, organizer })
      continue
    }
    const instances = expandSeriesViewInRange(
      [event as SeriesViewInput],
      overridesBySeries.get(row.id) ?? [],
      expansion.windowStart,
      expansion.windowEnd,
      zoneMap.get(row.userId),
    ) as ViewEvent[]
    const baseline = baselineOf(grant)
    const occurrenceExceptions = exceptions.get(grant.id) ?? []
    const recurrenceSummary = describeRecurrence(row.rrule, false)
    for (const instance of instances) {
      if (
        !instance.recurrenceId ||
        !canParticipantSeeOccurrence(
          baseline,
          occurrenceExceptions,
          instance.recurrenceId,
        ) ||
        (window && !inWindow(instance, window))
      )
        continue
      result.push({
        ...instance,
        categoryId,
        // Never give participants rules from which to generate ungranted slots.
        rrule: null,
        exdate: null,
        recurrenceSummary,
        viewOnly: true,
        organizer,
      } as ViewEvent)
    }
  }
  return result
}

/**
 * The list read owns retrieval, expansion, grants and final selection. Callers
 * enrich only the selected rows, not every candidate fetched for expansion.
 * No server cache: each request observes current grants and event writes.
 */
export async function loadEventWindow(
  viewer: Viewer,
  options: EventWindow & {
    timeZone: string
    categoryIds?: string[]
    legacy?: boolean
  },
): Promise<ViewEvent[]> {
  const [owned, shared] = await Promise.all([
    ownedEvents(viewer.id, options, options.legacy ?? false),
    getSharedEvents(viewer, options.legacy ? undefined : options),
  ])
  const masters: SeriesViewInput[] = []
  const overrides: SeriesViewInput[] = []
  for (const row of owned) {
    const event = decryptEvent(row) as SeriesViewInput
    if (row.seriesId === null) masters.push(event)
    else overrides.push(event)
  }
  const expanded = expandSeriesViewInRange(
    masters,
    overrides,
    options.windowStart,
    options.windowEnd,
    options.timeZone,
  ) as ViewEvent[]
  const categories = options.categoryIds ? new Set(options.categoryIds) : null
  const result = new Map<string, ViewEvent>()
  // An organiser may have added their own invite. Their owned copy wins.
  for (const event of [...expanded, ...shared]) {
    if (!options.legacy && !inWindow(event, options)) continue
    if (categories && (!event.categoryId || !categories.has(event.categoryId)))
      continue
    if (!result.has(event.id)) result.set(event.id, event)
  }
  return [...result.values()]
}
