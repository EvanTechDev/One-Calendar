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
  asc,
  gte,
  type SQL,
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
type Batch = { anchor: Date; size: number }
type SharedReader = ((window?: EventWindow) => ViewEvent[]) & {
  hasRecurring: boolean
  candidates: Event[]
}

// Date-only probes find bounded plain-event candidates without decrypting them.
// Recurring occurrences are counted after expansion, never as one master row.
async function candidateWindow(
  scope: SQL,
  required: EventWindow,
  batch: Batch,
  includeOverrides = false,
) {
  const plain = and(
    scope,
    isNull(calendarEvents.rrule),
    includeOverrides ? undefined : isNull(calendarEvents.seriesId),
  )
  const db = getDb()
  const [before, after] = await Promise.all([
    db
      .select({ startDate: calendarEvents.startDate })
      .from(calendarEvents)
      .where(and(plain, lt(calendarEvents.startDate, batch.anchor)))
      .orderBy(desc(calendarEvents.startDate))
      .limit(batch.size),
    db
      .select({ startDate: calendarEvents.startDate })
      .from(calendarEvents)
      .where(and(plain, gte(calendarEvents.startDate, batch.anchor)))
      .orderBy(asc(calendarEvents.startDate))
      .limit(batch.size),
  ])
  // Read the complete interval, including boundary ties and spanning events,
  // rather than advertising a partially fetched timestamp as complete.
  return {
    windowStart: new Date(
      Math.min(
        required.windowStart.getTime(),
        ...before.map((row) => row.startDate.getTime()),
      ),
    ),
    windowEnd: new Date(
      Math.max(
        required.windowEnd.getTime(),
        ...after.map((row) => row.startDate.getTime() + 1),
      ),
    ),
  }
}

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
  batch?: Batch,
) {
  const db = getDb()
  const recurring = or(
    isNotNull(calendarEvents.rrule),
    isNotNull(calendarEvents.seriesId),
  )
  if (!legacy) {
    if (batch)
      window = await candidateWindow(
        eq(calendarEvents.userId, viewerId),
        window,
        batch,
      )
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
async function prepareSharedEvents(
  viewer: { email: string },
  window?: EventWindow,
  eventId?: string,
  batch?: Batch,
): Promise<SharedReader> {
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
  if (grants.length === 0)
    return Object.assign(() => [], { hasRecurring: false, candidates: [] })
  const grantByEvent = new Map(grants.map((grant) => [grant.eventId, grant]))
  const scope = inArray(calendarEvents.id, [...grantByEvent.keys()])
  const readWindow =
    window && batch ? await candidateWindow(scope, window, batch, true) : window
  const [rows, exceptions] = await Promise.all([
    db
      .select()
      .from(calendarEvents)
      .where(
        and(
          scope,
          readWindow
            ? or(isNotNull(calendarEvents.rrule), overlaps(readWindow))
            : undefined,
        ),
      ),
    getOccurrencesForInvites(grants.map((grant) => grant.id)),
  ])
  if (rows.length === 0)
    return Object.assign(() => [], { hasRecurring: false, candidates: [] })

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
  const candidates: Event[] = []
  for (const row of overrides) {
    if (!row.seriesId) continue
    const event = decryptEvent(row)
    candidates.push(event)
    const list = overridesBySeries.get(row.seriesId) ?? []
    list.push(event as SeriesViewInput)
    overridesBySeries.set(row.seriesId, list)
  }
  const decrypted = rows.map((row) => ({ row, event: decryptEvent(row) }))
  return Object.assign(
    (window?: EventWindow) => {
      const expansion = window ?? defaultExpansionWindow()
      const result: ViewEvent[] = []
      for (const { row, event } of decrypted) {
        const grant = grantByEvent.get(row.id)!
        const owner = ownerMap.get(row.userId)
        const organizer = owner
          ? { name: owner.name, email: owner.email, image: owner.image }
          : null
        const categoryId = grant.categoryId ?? row.categoryId
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
    },
    {
      hasRecurring: seriesIds.length > 0,
      candidates: [...candidates, ...decrypted.map(({ event }) => event)],
    },
  )
}

export async function getSharedEvents(
  viewer: { email: string },
  window?: EventWindow,
  eventId?: string,
) {
  return (await prepareSharedEvents(viewer, window, eventId))(window)
}

/**
 * The list read owns retrieval, expansion, grants and final selection. Callers
 * enrich only the selected rows, not every candidate fetched for expansion.
 * No server cache: each request observes current grants and event writes.
 */
async function prepareEventWindow(
  viewer: Viewer,
  options: EventWindow & {
    timeZone: string
    categoryIds?: string[]
    legacy?: boolean
  },
  batch?: Batch,
): Promise<
  ((window: EventWindow) => ViewEvent[]) & {
    hasRecurring: boolean
    candidateWindow: EventWindow
  }
> {
  const [owned, shared] = await Promise.all([
    ownedEvents(viewer.id, options, options.legacy ?? false, batch),
    prepareSharedEvents(
      viewer,
      options.legacy ? undefined : options,
      undefined,
      batch,
    ),
  ])
  const masters: SeriesViewInput[] = []
  const overrides: SeriesViewInput[] = []
  const candidates: Event[] = [...shared.candidates]
  for (const row of owned) {
    const event = decryptEvent(row)
    if (row.seriesId === null) masters.push(event as SeriesViewInput)
    else overrides.push(event as SeriesViewInput)
    candidates.push(event)
  }
  const categories = options.categoryIds ? new Set(options.categoryIds) : null
  const candidateWindow = { ...options }
  for (const event of candidates) {
    if (event.startDate < candidateWindow.windowStart)
      candidateWindow.windowStart = event.startDate
    if (event.endDate > candidateWindow.windowEnd)
      candidateWindow.windowEnd = event.endDate
  }
  return Object.assign(
    (window: EventWindow) => {
      const expanded = expandSeriesViewInRange(
        masters,
        overrides,
        window.windowStart,
        window.windowEnd,
        options.timeZone,
      ) as ViewEvent[]
      const result = new Map<string, ViewEvent>()
      // An organiser may have added their own invite. Their owned copy wins.
      for (const event of [
        ...expanded,
        ...shared(options.legacy ? undefined : window),
      ]) {
        if (!options.legacy && !inWindow(event, window)) continue
        if (
          categories &&
          (!event.categoryId || !categories.has(event.categoryId))
        )
          continue
        if (!result.has(event.id)) result.set(event.id, event)
      }
      return [...result.values()]
    },
    {
      hasRecurring:
        masters.some((event) => !!event.rrule?.trim()) || shared.hasRecurring,
      candidateWindow,
    },
  )
}

export async function loadEventWindow(
  viewer: Viewer,
  options: EventWindow & {
    timeZone: string
    categoryIds?: string[]
    legacy?: boolean
  },
) {
  return (await prepareEventWindow(viewer, options))(options)
}

/** A count target with complete date coverage, bounded even for infinite rules. */
export async function loadEventBatch(
  viewer: Viewer,
  options: EventWindow & {
    timeZone: string
    anchor: Date
    size: number
    exclude?: EventWindow
  },
) {
  const read = await prepareEventWindow(viewer, options, {
    anchor: options.anchor,
    size: options.size,
  })
  const anchor = options.anchor.getTime()
  const day = 86400000
  // Do not scan forever for 150 occurrences of a very sparse/infinite rule.
  // The speculative horizon must never hide known rows, including old plain
  // events, series anchors and moved overrides. Extend toward those candidates
  // only while that side is still short of the count target.
  const horizon = 50 * 365 * day
  const pastLimit = Math.min(
    anchor - horizon,
    read.candidateWindow.windowStart.getTime(),
  )
  const futureLimit = Math.max(
    anchor + horizon,
    read.candidateWindow.windowEnd.getTime(),
  )
  const searchRadius = Math.max(anchor - pastLimit, futureLimit - anchor)
  let radius = 7 * day
  let window = read.hasRecurring
    ? { windowStart: options.windowStart, windowEnd: options.windowEnd }
    : read.candidateWindow
  for (;;) {
    const events = read(window)
    const before = events
      .filter((e) => e.startDate.getTime() < anchor)
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
    const after = events
      .filter((e) => e.startDate.getTime() >= anchor)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    const enoughBefore = before.length >= options.size
    const enoughAfter = after.length >= options.size
    const start = enoughBefore
      ? Math.min(
          options.windowStart.getTime(),
          before[options.size - 1].startDate.getTime(),
        )
      : window.windowStart.getTime()
    const end = enoughAfter
      ? Math.max(
          options.windowEnd.getTime(),
          after[options.size - 1].startDate.getTime() + 1,
        )
      : window.windowEnd.getTime()
    if (
      !read.hasRecurring ||
      (enoughBefore && enoughAfter) ||
      radius >= searchRadius
    ) {
      const coverage = {
        // Fewer plain events than the target exhausts that side. Reuse empty
        // space too, instead of fetching every month of a sparse calendar.
        windowStart: new Date(
          !read.hasRecurring && !enoughBefore
            ? Math.min(start, anchor - horizon)
            : start,
        ),
        windowEnd: new Date(
          !read.hasRecurring && !enoughAfter
            ? Math.max(end, anchor + horizon)
            : end,
        ),
      }
      return {
        // Let the client discard deleted/revoked rows from its retained half
        // without transferring those complete event objects a second time.
        retainedIds: options.exclude
          ? events
              .filter(
                (e) => inWindow(e, coverage) && inWindow(e, options.exclude!),
              )
              .map((e) => e.id)
          : undefined,
        events: events.filter(
          (e) =>
            inWindow(e, coverage) &&
            !(options.exclude && inWindow(e, options.exclude)),
        ),
        coverage: {
          startDate: coverage.windowStart.toISOString(),
          endDate: coverage.windowEnd.toISOString(),
          timezone: options.timeZone,
        },
        batchSize: options.size,
        searchLimited: read.hasRecurring && !(enoughBefore && enoughAfter),
        complete: !read.hasRecurring && !enoughBefore && !enoughAfter,
      }
    }
    radius = Math.min(searchRadius, radius * 4)
    window = {
      windowStart: new Date(
        enoughBefore
          ? start
          : Math.min(
              options.windowStart.getTime(),
              Math.max(pastLimit, anchor - radius),
            ),
      ),
      windowEnd: new Date(
        enoughAfter
          ? end
          : Math.max(
              options.windowEnd.getTime(),
              Math.min(futureLimit, anchor + radius),
            ),
      ),
    }
  }
}
