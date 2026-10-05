import { type NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import {
  calendarEvents,
  calendarCategories,
  eventInvites,
  settings,
  user,
} from '@/lib/drizzle/schema'
import { and, eq, gte, inArray, lte, or, desc, isNotNull } from 'drizzle-orm'
import { encryptField, encryptJsonField } from '@/lib/field-crypto'
import crypto from 'crypto'
import { getAuthedUser, decryptEvent } from '@/lib/api-helpers'
import {
  getCachedEvents,
  setCachedEvents,
  invalidateEventCache,
  filterCachedByCategory,
  resolveEventSource,
  groupByMonth,
} from '@/lib/cache/events'
import { fullMonthRange, affectedMonths } from '@/lib/cache/keys'
import {
  eventSchema,
  firstZodMessage,
  recurringFieldsSchema,
} from '@/lib/validation'
import {
  mergeOverride,
  resolveMasterEditStamp,
  planInstanceChange,
  resolveInstance,
  type ApplyTo,
  type EventRow,
  type InstanceChangePlan,
} from '@/lib/event-service'
import {
  DEFAULT_EXPANSION_WINDOW_MS,
  adaptRuleToStart,
  defaultExpansionWindow,
  expandSeriesViewInRange,
  firstVisibleStampOfSeries,
  isInstanceId,
  isSeriesEvent,
  parseInstanceId,
  parseRfcStamp,
  addWallClockDays,
  canTranslateRuleByDays,
  describeRecurrence,
  shiftExdates,
  shiftToAnchorClock,
  translateRuleByDays,
  translateStampsByDays,
  wallClockDayDelta,
  withUntil,
  type SeriesViewInput,
} from '@/lib/recurrence/engine'
import {
  canParticipantSeeOccurrence,
  rsvpForOccurrence,
} from '@/lib/invites/visibility'
import {
  baselineOf,
  getOccurrencesForInvites,
  readInviteToken,
} from '@/lib/invites/invite-service'
import { carryInvitesAcrossSplit } from '@/lib/invites/split-carry'
import {
  encryptMergedFields,
  writeInstanceOverride,
  isValidRrule,
  isValidStamp,
  remapSeriesOverrideStamps,
  shiftOverrideStamps,
  type EventWriteDb,
} from '@/lib/event-write'
import {
  commitMeetingForEvent,
  deleteMeetingsForEvents,
  getMeetingsForEvents,
  moveMeetingToEvent,
} from '@zntr/meetings'
import { meetingUrl } from '@/lib/meetings'
import { z } from 'zod'
import { dedupeById } from '@/lib/array-mutations'
import { isValidTimezone } from '@/lib/timezone'
import { MAX_CALENDAR_RANGE_MS } from '@/lib/calendar-range'

export const runtime = 'nodejs'

const APPLY_TO_VALUES = new Set(['all', 'single', 'following'])

type EnrichedInvite = {
  id: string
  email: string
  status: 'pending' | 'accepted' | 'maybe' | 'declined'
  inviteToken: string
  emailSent: boolean
  addedToCalendar: boolean
  userName: string | null
  userImage: string | null
  /**
   * The emailed link died before the participant ever joined, so they cannot
   * act until the organiser resends (ADR-0013). False once `addedToCalendar`:
   * that grant is permanent, whatever the link's state.
   */
  inviteExpired: boolean
}

/**
 * Reject a `categoryId` that does not belong to the caller.
 *
 * Every other category-referencing write pairs the id with
 * `eq(userId, session.userId)` in the same statement (categories, countdowns,
 * the invite PATCH, the MCP list filter). The event write was the one exception:
 * it passed `body.categoryId` straight through, so an event could hold a
 * stranger's category id. No reader discloses the name — they all scope by
 * `userId` — but the row would render uncategorised for its owner, and the
 * foreign category's `ON DELETE SET NULL` would later mutate it.
 *
 * `null` (uncategorised) is always allowed and costs no query.
 */
async function rejectForeignCategory(
  categoryId: string | null | undefined,
  userId: string,
): Promise<boolean> {
  if (!categoryId) return false
  const [cat] = await getDb()
    .select({ id: calendarCategories.id })
    .from(calendarCategories)
    .where(
      and(
        eq(calendarCategories.id, categoryId),
        eq(calendarCategories.userId, userId),
      ),
    )
  return !cat
}

async function invalidateMasterCache(
  userId: string,
  seriesId: string,
): Promise<void> {
  const [master] = await getDb()
    .select({
      startDate: calendarEvents.startDate,
      endDate: calendarEvents.endDate,
    })
    .from(calendarEvents)
    .where(
      and(eq(calendarEvents.id, seriesId), eq(calendarEvents.userId, userId)),
    )
  if (master) {
    await invalidateEventCache(
      userId,
      master.startDate.toISOString(),
      master.endDate.toISOString(),
    )
  }
}

type Dbx =
  | ReturnType<typeof getDb>
  | Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0]

async function fetchOverrides(
  seriesId: string,
  dbx: Dbx = getDb(),
): Promise<EventRow[]> {
  const rows = await dbx
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.seriesId, seriesId))
  return rows as unknown as EventRow[]
}

/**
 * Every override belonging to any of `seriesIds`, indexed by series.
 *
 * One statement for the whole set, for the same reason
 * `deleteSeriesOccurrences` deletes in one statement: a caller with N series
 * would otherwise pay N queries where the table has one index on `series_id`
 * and can answer all of them at once.
 */
async function fetchOverridesFor(
  seriesIds: string[],
  dbx: Dbx = getDb(),
): Promise<Map<string, EventRow[]>> {
  const unique = [...new Set(seriesIds)]
  const bySeries = new Map<string, EventRow[]>()
  if (unique.length === 0) return bySeries

  const rows = (await dbx
    .select()
    .from(calendarEvents)
    .where(inArray(calendarEvents.seriesId, unique))) as unknown as EventRow[]

  for (const row of rows) {
    const key = row.seriesId
    if (!key) continue
    const existing = bySeries.get(key)
    if (existing) existing.push(row)
    else bySeries.set(key, [row])
  }
  return bySeries
}

async function deleteRow(
  userId: string,
  row: EventRow,
  dbx: Dbx = getDb(),
): Promise<void> {
  const rowIds = row.seriesId
    ? [row.id]
    : [row.id, ...(await fetchOverrides(row.id, dbx)).map((r) => r.id)]
  if (rowIds.length > 0) {
    // Reminder receipts survive deletion. Reconcile after the transaction has
    // committed, never call the provider from inside an event transaction.
    // Occurrence rows cascade from event_invites, which cascades from
    // calendar_events, so deleting the invites removes their per-occurrence
    // visibility and RSVPs with them.
    await dbx.delete(eventInvites).where(inArray(eventInvites.eventId, rowIds))
    // Event Meetings live in a separate package with no database FK back to
    // this table on purpose (ADR-0017), so their cascade runs here. Deleting
    // the row is what invalidates the meeting link. One statement for the whole
    // set, like the eventInvites delete above — meetings only ever attach to
    // masters, so iterating cost 50 pointless statements on a 50-override
    // series.
    await deleteMeetingsForEvents(dbx, rowIds)
    await dbx
      .delete(calendarEvents)
      .where(
        and(
          inArray(calendarEvents.id, rowIds),
          eq(calendarEvents.userId, userId),
        ),
      )
  }
  await invalidateEventCache(
    userId,
    row.startDate.toISOString(),
    row.endDate.toISOString(),
  )
}

async function applySplitPlan(
  userId: string,
  plan: InstanceChangePlan,
  master: EventRow,
  opts?: {
    /**
     * Join this caller's transaction instead of opening one. The call sites that
     * also re-stamp the moved overrides need the split writes and the re-stamps
     * to be one unit, and a nested `transaction()` would commit independently.
     */
    db?: EventWriteDb
    /**
     * The organiser's timezone, already resolved by the handler via
     * `resolveUserTz`. Carried grants are clock-remapped in it, exactly as the
     * override path remaps override stamps.
     */
    timeZone?: string
  },
): Promise<ReturnType<typeof decryptEvent> | null> {
  const timeZone = opts?.timeZone
  const split = plan.split!
  const newId = split.newSeries.id
  const fields = encryptMergedFields(newId, split.newSeries.fields)
  // The four split writes are atomic: a mid-sequence failure would otherwise
  // leave the old series untruncated next to the new one (duplicated
  // occurrences) or overrides reparented to a master that never truncated.
  // Cache invalidation stays OUTSIDE the transaction (after commit).
  const writeSplit = async (tx: EventWriteDb) => {
    const [inserted] = await tx
      .insert(calendarEvents)
      .values({
        id: newId,
        userId,
        rrule: split.newSeries.rrule,
        exdate: split.newSeries.exdate,
        ...fields,
      } as typeof calendarEvents.$inferInsert)
      .returning()

    if (plan.deleteOverrideId) {
      await tx
        .delete(calendarEvents)
        .where(
          and(
            eq(calendarEvents.id, plan.deleteOverrideId),
            eq(calendarEvents.userId, userId),
          ),
        )
    }

    if (split.moveOverrideIds.length > 0) {
      await tx
        .update(calendarEvents)
        .set({ seriesId: newId })
        .where(
          and(
            inArray(calendarEvents.id, split.moveOverrideIds),
            eq(calendarEvents.userId, userId),
          ),
        )
    }

    // Participants must not silently lose the tail of the series. Invites are
    // bound to the master, so a split leaves the new master with none unless
    // they are carried across — preserving each token, because a split is the
    // organiser's edit and must not invalidate a participant's link. See
    // ADR-0009 (invites and their visibility survive a series split).
    await carryInvitesAcrossSplit(tx, {
      oldMasterId: master.id,
      newMasterId: newId,
      boundaryStamp: split.masterUntil,
      clockSource: split.newSeries.startDate,
      timeZone,
    })

    // A Series has one Meeting whose link stays stable across occurrences
    // (ADR-0019), so the split's tail — the part participants are still going
    // to attend — keeps it. Unconditional, exactly like the invite carry above:
    // guarding this on `masterBecomesEmpty` meant the ordinary mid-series
    // "this and following" split never moved it, so the future segment lost its
    // meeting while the past segment kept a link nobody would use again.
    //
    // Must run before the branch below can delete the old master, or the
    // meeting would be cascaded away with it.
    await moveMeetingToEvent(tx, master.id, newId)

    if (split.masterBecomesEmpty) {
      // The old series would render nothing after truncation (split at its
      // first slot): drop it so repeated "this and following" edits cannot
      // pile up invisible zombie masters. Overrides were already re-parented
      // above, and the FK is ON DELETE CASCADE for anything still pointing
      // here, so nothing is orphaned.
      //
      // Safe now that anything still needed was carried to the new master
      // above; deleting first would have destroyed the grants outright.
      await tx
        .delete(eventInvites)
        .where(inArray(eventInvites.eventId, [master.id]))
      await tx
        .delete(calendarEvents)
        .where(
          and(
            eq(calendarEvents.id, master.id),
            eq(calendarEvents.userId, userId),
          ),
        )
    } else {
      await tx
        .update(calendarEvents)
        .set({
          rrule: withUntil(master.rrule!, split.masterUntil),
          exdate: split.masterExdate,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(calendarEvents.id, master.id),
            eq(calendarEvents.userId, userId),
          ),
        )
    }

    return inserted
  }
  const newMaster = opts?.db
    ? await writeSplit(opts.db)
    : await getDb().transaction(writeSplit)

  await Promise.all([
    invalidateEventCache(
      userId,
      master.startDate.toISOString(),
      master.endDate.toISOString(),
    ),
    invalidateEventCache(
      userId,
      split.newSeries.startDate.toISOString(),
      split.newSeries.endDate.toISOString(),
    ),
  ])

  // The response identifies both roots. The outer mutation boundary reconciles
  // the head then the tail AFTER commit, including reminders due before cron.

  return decryptEvent(newMaster)
}

/**
 * The Meeting attached to each of these events, keyed by the id the meeting
 * hangs off — always the SERIES master, because a Series gets one Meeting
 * (ADR-0019) and an expanded occurrence's id is a synthetic instance id no row
 * exists for.
 *
 * This is the fix for a meeting link that arrived a beat late and, right after
 * a save, not at all. Every event surface used to resolve it with its own
 * `GET /api/meetings?eventId=` from an effect — so the link was a second round
 * trip that had not finished when the popover painted, and the SWR-cached event
 * list the preview reads had no notion that a meeting had appeared. Riding
 * along with the event payload removes the request instead of hiding it, and
 * makes the existing `mutate(DATA_KEYS.events)` after a save the one thing that
 * has to be right.
 *
 * A meeting is only reported to a viewer who OWNS the event. A participant's
 * shared copy learns the link through their invitation (ADR-0019: the Invite
 * Token's only meeting role is revealing the link on the invite page), not
 * through the organiser's list payload.
 */
async function meetingsForEvents(
  events: Array<ReturnType<typeof decryptEvent>>,
  viewerId: string,
): Promise<Map<string, { id: string; url: string }>> {
  const ownerKeys = [
    ...new Set(
      events
        .filter((e) => e.userId === viewerId)
        .map((e) => (e.seriesId ?? e.id) as string),
    ),
  ]
  const found = await getMeetingsForEvents(getDb(), ownerKeys)
  const out = new Map<string, { id: string; url: string }>()
  for (const [eventId, row] of found) {
    out.set(eventId, { id: row.id, url: meetingUrl(row.id) })
  }
  return out
}

/**
 * Display name and avatar for the given invitee addresses, lower-cased keys.
 * No query at all for an empty list, which is the common case for an event with
 * no invitations.
 */
async function inviteUsersByEmail(
  emails: string[],
): Promise<Record<string, { name: string; image: string | null }>> {
  if (emails.length === 0) return {}

  const users = await getDb()
    .select({
      email: user.email,
      name: user.name,
      image: user.image,
    })
    .from(user)
    .where(inArray(user.email, emails))

  return users.reduce(
    (acc: Record<string, { name: string; image: string | null }>, u) => {
      acc[u.email.toLowerCase()] = { name: u.name, image: u.image }
      return acc
    },
    {} as Record<string, { name: string; image: string | null }>,
  )
}

async function enrichEventsWithInvites(
  events: Array<ReturnType<typeof decryptEvent> & { instanceId?: string }>,
  viewerId: string,
  viewerEmail?: string,
): Promise<
  Array<
    ReturnType<typeof decryptEvent> & {
      invites: EnrichedInvite[]
      instanceId?: string
      meeting?: { id: string; url: string } | null
    }
  >
> {
  if (events.length === 0) {
    return events.map((e) => ({ ...e, invites: [] }))
  }

  const inviteIds = events.map((e) => e.seriesId ?? e.id)
  const idKeys = [...new Set(inviteIds)]
  const eventOwners = new Map(
    events.map((e) => [(e.seriesId ?? e.id) as string, e.userId]),
  )

  // The meetings lookup is keyed by the events' own ids and the invite read by
  // the invite rows — neither needs the other's result, so they go out together
  // instead of one after the other. `enrichEventsWithInvites` runs on every
  // `GET /api/events`, which is the app's hottest read: view switches, every
  // optimistic-write revalidation and every SWR focus revalidation all land here.
  const [meetings, allInvites] = await Promise.all([
    meetingsForEvents(events, viewerId),
    getDb()
      .select({
        id: eventInvites.id,
        eventId: eventInvites.eventId,
        email: eventInvites.email,
        status: eventInvites.status,
        inviteToken: eventInvites.inviteToken,
        inviteTokenHash: eventInvites.inviteTokenHash,
        emailSent: eventInvites.emailSent,
        addedToCalendar: eventInvites.addedToCalendar,
        expiresAt: eventInvites.expiresAt,
        baselineKind: eventInvites.baselineKind,
        fromStamp: eventInvites.fromStamp,
        untilStamp: eventInvites.untilStamp,
      })
      .from(eventInvites)
      .where(inArray(eventInvites.eventId, idKeys)),
  ])

  const inviteEmails = [
    ...new Set(allInvites.map((i) => i.email.toLowerCase())),
  ]

  // Both need `allInvites` and neither needs the other.
  const [occurrencesByInvite, userMap] = await Promise.all([
    // Per-occurrence exceptions, so the organiser sees who is on THIS
    // occurrence and their RSVP for it — not a series-wide answer.
    getOccurrencesForInvites(allInvites.map((i) => i.id)),
    inviteUsersByEmail(inviteEmails),
  ])

  const viewerEmailLower = viewerEmail?.toLowerCase()

  const invitesByEvent = allInvites.reduce(
    (acc: Record<string, typeof allInvites>, invite) => {
      if (!acc[invite.eventId]) acc[invite.eventId] = []
      acc[invite.eventId].push(invite)
      return acc
    },
    {} as Record<string, typeof allInvites>,
  )

  return events.map((e) => {
    const key = (e.seriesId ?? e.id) as string
    const candidates = invitesByEvent[key] ?? []
    // A plain event has no stamp, so every invite applies to it.
    const stamp = e.recurrenceId ?? null

    const invites = candidates
      .filter((invite) => {
        if (stamp === null) return true
        return canParticipantSeeOccurrence(
          baselineOf(invite),
          occurrencesByInvite.get(invite.id) ?? [],
          stamp,
        )
      })
      .map((invite) => {
        const emailLower = invite.email.toLowerCase()
        const isOwnInvite = emailLower === viewerEmailLower
        const exceptions = occurrencesByInvite.get(invite.id) ?? []
        const enriched: EnrichedInvite = {
          id: invite.id,
          email: invite.email,
          // RSVP is per-occurrence for a series; the invite row's own status
          // only answers for a non-recurring event.
          status:
            stamp === null
              ? (invite.status as EnrichedInvite['status'])
              : rsvpForOccurrence(exceptions, stamp),
          // Only the organiser or the invitee themselves get a usable token.
          inviteToken:
            eventOwners.get(invite.eventId) === viewerId || isOwnInvite
              ? readInviteToken(invite)
              : '',
          emailSent: invite.emailSent,
          addedToCalendar: invite.addedToCalendar,
          userName: userMap[emailLower]?.name ?? null,
          userImage: userMap[emailLower]?.image ?? null,
          // Dead link and no permanent grant: the participant cannot act
          // until the organiser resends (ADR-0013).
          inviteExpired:
            !invite.addedToCalendar &&
            !!invite.expiresAt &&
            invite.expiresAt <= new Date(),
        }
        return enriched
      })

    return { ...e, invites, meeting: meetings.get(key) ?? null }
  })
}

async function getSharedEvents(
  currentUser: { email: string },
  window?: { windowStart: Date; windowEnd: Date },
): Promise<
  Array<
    ReturnType<typeof decryptEvent> & {
      viewOnly: boolean
      organizer: {
        name: string
        email: string
        image: string | null
      } | null
    }
  >
> {
  // `expiresAt` is deliberately not checked, matching isEventViewableBy: it
  // bounds the emailed link, not the grant. `addedToCalendar` IS the grant,
  // permanent until revoked (ADR-0013).
  const liveInvites = await getDb()
    .select()
    .from(eventInvites)
    .where(
      and(
        eq(eventInvites.email, currentUser.email.toLowerCase()),
        eq(eventInvites.addedToCalendar, true),
      ),
    )
  if (liveInvites.length === 0) return []

  const inviteByEvent = new Map(liveInvites.map((i) => [i.eventId, i]))
  const occurrencesByInvite = await getOccurrencesForInvites(
    liveInvites.map((i) => i.id),
  )

  const sharedIds = liveInvites.map((i) => i.eventId)
  const sharedResults = await getDb()
    .select()
    .from(calendarEvents)
    .where(inArray(calendarEvents.id, sharedIds))

  const ownerIds = [...new Set(sharedResults.map((e) => e.userId))]
  const owners = ownerIds.length
    ? await getDb()
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        })
        .from(user)
        .where(inArray(user.id, ownerIds))
    : []

  const ownerMap = new Map(owners.map((u) => [u.id, u]))

  // Everything the loop below needs that is not already in hand, fetched up
  // front: the participants' own series overrides and their organisers' time
  // zones. Both were queries issued from inside the loop or one after another,
  // so a participant invited to N recurring events paid N+1 round-trips before
  // the first occurrence was even expanded.
  const [overridesBySeries, organiserTimeZones] = await Promise.all([
    fetchOverridesFor(sharedResults.map((r) => r.id)),
    organiserTimeZonesFor(ownerIds),
  ])

  const out: Array<
    ReturnType<typeof decryptEvent> & {
      viewOnly: boolean
      organizer: {
        name: string
        email: string
        image: string | null
      } | null
    }
  > = []

  for (const row of sharedResults) {
    const invite = inviteByEvent.get(row.id)
    if (!invite) continue

    const owner = row.userId ? ownerMap.get(row.userId) : null
    const organizer = owner
      ? { name: owner.name, email: owner.email, image: owner.image }
      : null
    const categoryId = invite.categoryId ?? row.categoryId
    const decrypted = decryptEvent(row)

    const isSeries = !!row.rrule && row.rrule.trim().length > 0
    if (!isSeries) {
      out.push({ ...decrypted, categoryId, viewOnly: true, organizer })
      continue
    }

    // A series is expanded and filtered HERE, and the rule is withheld from the
    // response. Handing a participant an rrule lets their client generate
    // occurrences they were never granted — see
    // ADR-0006 (participants never receive the recurrence rule).
    const exceptions = occurrencesByInvite.get(invite.id) ?? []
    const baseline = baselineOf(invite)
    const overrides = overridesBySeries.get(row.id) ?? []
    const instances = expandSeriesViewInRange(
      [decrypted as unknown as SeriesViewInput],
      overrides.map(decryptEvent) as unknown as SeriesViewInput[],
      window?.windowStart ?? new Date(Date.now() - DEFAULT_EXPANSION_WINDOW_MS),
      window?.windowEnd ?? new Date(Date.now() + DEFAULT_EXPANSION_WINDOW_MS),
      // The organiser's timezone, so the participant sees the occurrences the
      // organiser actually scheduled rather than a UTC-shifted set.
      organiserTimeZones.get(row.userId),
    ) as Array<ReturnType<typeof decryptEvent> & { instanceId?: string }>

    const recurrenceSummary = describeRecurrence(row.rrule!, false)

    for (const instance of instances) {
      const stamp = instance.recurrenceId
      if (
        stamp === null ||
        !canParticipantSeeOccurrence(baseline, exceptions, stamp)
      ) {
        continue
      }
      out.push({
        ...instance,
        categoryId,
        // Withheld deliberately. Do not "restore" these.
        rrule: null,
        exdate: null,
        recurrenceSummary,
        viewOnly: true,
        organizer,
      } as (typeof out)[number])
    }
  }

  return out
}

/**
 * Timezones of the given users, from their settings blob. A series must be
 * expanded in its organiser's timezone or a participant sees occurrences at the
 * wrong wall-clock time.
 */
async function organiserTimeZonesFor(
  userIds: string[],
): Promise<Map<string, string | undefined>> {
  const map = new Map<string, string | undefined>()
  if (userIds.length === 0) return map

  const rows = await getDb()
    .select({ userId: settings.userId, data: settings.data })
    .from(settings)
    .where(inArray(settings.userId, userIds))

  for (const row of rows) {
    const tz = (row.data as { timezone?: unknown } | null)?.timezone
    map.set(row.userId, typeof tz === 'string' && tz ? tz : undefined)
  }
  return map
}

type MergedViewEvent = ReturnType<typeof decryptEvent> & {
  instanceId?: string
  invites?: EnrichedInvite[]
  /** The event's Meeting, resolved by lookup — no column on the row (ADR-0019). */
  meeting?: { id: string; url: string } | null
  viewOnly?: boolean
  organizer?: {
    name: string
    email: string
    image: string | null
  } | null
}

async function loadMergedView(
  user: { id: string; email: string },
  baseRows: ReturnType<typeof decryptEvent>[],
  window?: { windowStart?: Date; windowEnd?: Date },
  timeZone?: string,
): Promise<MergedViewEvent[]> {
  const recurringRows = await getDb()
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.userId, user.id),
        or(isNotNull(calendarEvents.rrule), isNotNull(calendarEvents.seriesId)),
      ),
    )
  const all = dedupeById([...baseRows, ...recurringRows.map(decryptEvent)])
  const windowStart =
    window?.windowStart ?? new Date(Date.now() - DEFAULT_EXPANSION_WINDOW_MS)
  const windowEnd =
    window?.windowEnd ?? new Date(Date.now() + DEFAULT_EXPANSION_WINDOW_MS)
  const expanded = expandSeriesViewInRange(
    all.filter((e) => e.seriesId === null) as SeriesViewInput[],
    all.filter((e) => e.seriesId !== null) as SeriesViewInput[],
    windowStart,
    windowEnd,
    timeZone,
  ) as MergedViewEvent[]
  const withShared = [
    ...expanded,
    ...(await getSharedEvents(user, { windowStart, windowEnd })),
  ] as MergedViewEvent[]
  return enrichEventsWithInvites(withShared, user.id, user.email)
}

async function loadSeriesView(
  user: { id: string; email: string },
  seriesIds: string[],
  timeZone?: string,
): Promise<MergedViewEvent[]> {
  const ids = [...new Set(seriesIds)]
  if (ids.length === 0) return []
  const rows = await getDb()
    .select()
    .from(calendarEvents)
    .where(
      and(
        or(
          inArray(calendarEvents.id, ids),
          inArray(calendarEvents.seriesId, ids),
        ),
        eq(calendarEvents.userId, user.id),
      ),
    )
  const masters = rows
    .filter((r) => r.seriesId === null)
    .map(decryptEvent) as unknown as SeriesViewInput[]
  const overrides = rows
    .filter((r) => r.seriesId !== null)
    .map(decryptEvent) as unknown as SeriesViewInput[]
  const window = defaultExpansionWindow()
  const expanded = expandSeriesViewInRange(
    masters,
    overrides,
    window.windowStart,
    window.windowEnd,
    timeZone,
  ) as MergedViewEvent[]
  return enrichEventsWithInvites(expanded, user.id, user.email)
}

async function resolveUserTz(
  userId: string,
  explicit?: string | null,
): Promise<string> {
  const candidate = explicit?.trim()
  if (candidate && isValidTimezone(candidate)) return candidate
  try {
    const [row] = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.userId, userId))
    const data = (row?.data ?? {}) as { timezone?: unknown }
    if (typeof data.timezone === 'string' && isValidTimezone(data.timezone)) {
      return data.timezone
    }
  } catch {
    // fall through to UTC
  }
  return 'UTC'
}

export const GET = async function GET(request: NextRequest) {
  const currentUser = await getAuthedUser()
  if (!currentUser)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const categoryIds = searchParams.get('categoryIds')
  const timeZone = await resolveUserTz(currentUser.id, searchParams.get('tz'))

  if (
    Boolean(startDate) !== Boolean(endDate) ||
    (startDate &&
      endDate &&
      (!Number.isFinite(Date.parse(startDate)) ||
        !Number.isFinite(Date.parse(endDate)) ||
        Date.parse(startDate) >= Date.parse(endDate) ||
        Date.parse(endDate) - Date.parse(startDate) > MAX_CALENDAR_RANGE_MS))
  ) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
  }

  if (id) {
    const parsedId = isInstanceId(id) ? parseInstanceId(id) : null
    // Shared search hits can be outside the currently loaded window. Reuse
    // the same grant/occurrence visibility checks as the calendar list.
    const sharedFallback = async () => {
      let window: { windowStart: Date; windowEnd: Date } | undefined
      if (parsedId) {
        const stamp = parseRfcStamp(parsedId.recurrenceId).date
        window = {
          windowStart: new Date(stamp.getTime() - 86400000),
          windowEnd: new Date(stamp.getTime() + 86400000),
        }
        const [override] = await getDb()
          .select()
          .from(calendarEvents)
          .where(
            and(
              eq(calendarEvents.seriesId, parsedId.seriesId),
              eq(calendarEvents.recurrenceId, parsedId.recurrenceId),
            ),
          )
        if (override)
          window = {
            windowStart: override.startDate,
            windowEnd: new Date(override.endDate.getTime() + 1),
          }
      }
      const shared = (await getSharedEvents(currentUser, window)).find(
        (event) => event.id === id,
      )
      if (!shared)
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      const [event] = await enrichEventsWithInvites(
        [shared],
        currentUser.id,
        currentUser.email,
      )
      return NextResponse.json(
        { event },
        { headers: { 'Cache-Control': 'private, no-store' } },
      )
    }
    if (parsedId) {
      const [master] = await getDb()
        .select()
        .from(calendarEvents)
        .where(
          and(
            eq(calendarEvents.id, parsedId.seriesId),
            eq(calendarEvents.userId, currentUser.id),
          ),
        )
      if (
        !master ||
        !isSeriesEvent({
          rrule: master.rrule,
        })
      ) {
        return sharedFallback()
      }
      const overrides = (await fetchOverrides(master.id)).map((o) =>
        decryptEvent(o as typeof calendarEvents.$inferSelect),
      )
      const resolved = resolveInstance(
        decryptEvent(master),
        parsedId.recurrenceId,
        overrides,
        timeZone,
      )
      if (!resolved) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }
      const [withInvites] = await enrichEventsWithInvites(
        [
          {
            ...resolved,
            id,
            instanceId: id,
            seriesStartDate: master.startDate,
            isFirstInstance:
              parsedId.recurrenceId ===
              firstVisibleStampOfSeries(master, timeZone),
            isOverride: overrides.some(
              (override) => override.recurrenceId === parsedId.recurrenceId,
            ),
          },
        ],
        currentUser.id,
        currentUser.email,
      )
      return NextResponse.json({ event: withInvites })
    }

    const [row] = await getDb()
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.id, id),
          eq(calendarEvents.userId, currentUser.id),
        ),
      )
    if (!row) {
      return sharedFallback()
    }
    const [withInvites] = await enrichEventsWithInvites(
      [{ ...decryptEvent(row), instanceId: row.id }],
      currentUser.id,
      currentUser.email,
    )
    return NextResponse.json({ event: withInvites })
  }

  const filters = [eq(calendarEvents.userId, currentUser.id)]

  let decrypted: ReturnType<typeof decryptEvent>[] = []
  // Tracked separately from `decrypted.length`, which conflates a cache MISS
  // with a cache hit on an empty month. Testing the length meant every request
  // for an empty month queried the database -- and since the date filters are
  // only pushed on the miss branch, that query ran UNFILTERED, reading the
  // user's whole history and writing it back into per-month cache keys.
  let source: 'cache' | 'database' = 'database'

  if (startDate && endDate) {
    const cached = await getCachedEvents(currentUser.id, startDate, endDate)
    source = resolveEventSource(cached)
    if (cached) {
      // The cache is keyed by user and month, so a cached month holds every
      // category. The categoryId filter below only reaches the database query,
      // so without this a category-filtered request got the whole month.
      decrypted = filterCachedByCategory(
        cached,
        categoryIds ? categoryIds.split(',') : null,
      ).map(decryptEvent)
    } else {
      const range = fullMonthRange(startDate, endDate)
      filters.push(lte(calendarEvents.startDate, range.end))
      filters.push(gte(calendarEvents.endDate, range.start))
    }
  }

  if (categoryIds) {
    filters.push(inArray(calendarEvents.categoryId, categoryIds.split(',')))
  }

  if (source === 'database') {
    // The cache is keyed by user and month only, so a category filter must
    // never reach the rows that get written into it: the filtered result was
    // stored under the month key, and the next unfiltered read hit it as a
    // complete month and silently omitted every event outside the requested
    // category for the rest of the TTL. A category-filtered miss therefore
    // skips the write — the read path already filters the cached month, so the
    // next full read populates it correctly.
    const writeBackToCache = !(startDate && endDate) || !categoryIds

    const query = getDb()
      .select()
      .from(calendarEvents)
      .where(and(...filters))

    if (!(startDate && endDate)) {
      query.orderBy(desc(calendarEvents.startDate)).limit(1000)
    }

    const results = await query

    if (startDate && endDate && writeBackToCache) {
      const grouped = groupByMonth(results, fullMonthRange(startDate, endDate))
      await Promise.all(
        affectedMonths(startDate, endDate).map((ym) =>
          setCachedEvents(currentUser.id, ym, grouped.get(ym) ?? []),
        ),
      )
    }

    decrypted = results.map(decryptEvent)
  }

  const windowStart =
    startDate && endDate
      ? fullMonthRange(startDate, endDate).start
      : new Date(Date.now() - DEFAULT_EXPANSION_WINDOW_MS)
  const windowEnd =
    startDate && endDate
      ? fullMonthRange(startDate, endDate).end
      : new Date(Date.now() + DEFAULT_EXPANSION_WINDOW_MS)

  const eventsWithInvites = await loadMergedView(
    currentUser,
    decrypted,
    {
      windowStart,
      windowEnd,
    },
    timeZone,
  )

  if (categoryIds) {
    const ids = categoryIds.split(',')
    eventsWithInvites.splice(
      0,
      eventsWithInvites.length,
      ...eventsWithInvites.filter(
        (e) => e.categoryId && ids.includes(e.categoryId),
      ),
    )
  }

  if (startDate && endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    return NextResponse.json({
      events: eventsWithInvites.filter(
        (e) => e.startDate < end && e.endDate > start,
      ),
    })
  }

  return NextResponse.json({ events: eventsWithInvites })
}

const postHandler = async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bodyResult = await request.json().catch(() => null)
  const parsedBody = z
    .object({})
    .passthrough()
    .and(recurringFieldsSchema)
    .and(eventSchema)
    .safeParse(bodyResult)
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: firstZodMessage(parsedBody.error) },
      { status: 400 },
    )
  }
  // Null is a legal value the client actually sends for a non-recurring event
  // (see recurringFieldsSchema); narrowing it away here would make every
  // downstream `?? ` and null-check below look redundant when it is not.
  const body = parsedBody.data as typeof parsedBody.data & {
    rrule?: string | null
    exdate?: string[] | null
    apply_to?: ApplyTo | null
    id?: string
    timezone?: string
  }

  const timeZone = await resolveUserTz(user.id, body.timezone)

  const rawRrule =
    typeof body.rrule === 'string' && body.rrule.trim().length > 0
      ? body.rrule
      : null
  if (rawRrule !== null && !isValidRrule(rawRrule)) {
    return NextResponse.json({ error: 'Invalid rrule' }, { status: 400 })
  }
  if (body.exdate !== null && body.exdate !== undefined) {
    if (rawRrule === null) {
      return NextResponse.json(
        { error: 'exdate requires rrule' },
        { status: 400 },
      )
    }
    for (const stamp of body.exdate) {
      if (!isValidStamp(stamp)) {
        return NextResponse.json({ error: 'Invalid exdate' }, { status: 400 })
      }
    }
  }

  const id = body.id ?? crypto.randomUUID()
  const isUpdate = !!body.id
  const parsedId = isInstanceId(id) ? parseInstanceId(id) : null

  if (await rejectForeignCategory(body.categoryId, user.id)) {
    return NextResponse.json({ error: 'Category not found' }, { status: 400 })
  }

  const submittedFields: Partial<EventRow> = {
    title: body.title,
    description: body.description ?? null,
    location: body.location ?? null,
    startDate: new Date(body.startDate),
    endDate: new Date(body.endDate),
    isAllDay: body.isAllDay ?? false,
    status: body.status ?? 'confirmed',
    color: body.color ?? null,
    categoryId: body.categoryId ?? null,
    participants: body.participants as unknown as string[] | undefined,
    notificationMinutes: body.notificationMinutes ?? null,
    emailReminder: body.emailReminder ?? false,
  }

  if (parsedId) {
    const [master] = await getDb()
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.id, parsedId.seriesId),
          eq(calendarEvents.userId, user.id),
        ),
      )
    if (
      !master ||
      !isSeriesEvent({
        rrule: master.rrule,
      })
    ) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    const masterRow = decryptEvent(master) as unknown as EventRow
    const overrides = (await fetchOverrides(masterRow.id)).map((o) =>
      decryptEvent(o as typeof calendarEvents.$inferSelect),
    )
    const override =
      overrides.find((o) => o.recurrenceId === parsedId.recurrenceId) ?? null
    const applyTo = body.apply_to ?? 'single'

    // Product rule: "all events" is only well-defined from the series' first
    // visible occurrence — a mid-series 'all' silently drops day moves and
    // edits only the current split segment. Master-id edits (the series
    // root) remain allowed below.
    if (applyTo === 'all') {
      const firstStamp = firstVisibleStampOfSeries(masterRow, timeZone)
      if (firstStamp === null || parsedId.recurrenceId !== firstStamp) {
        return NextResponse.json(
          {
            error:
              "apply_to 'all' is only allowed on the series' first occurrence",
          },
          { status: 400 },
        )
      }
    }

    if (applyTo === 'all') {
      const prevStartDate = masterRow.startDate
      const nextStartDate = submittedFields.startDate as Date
      const allDay = submittedFields.isAllDay ?? masterRow.isAllDay
      // "All events" translates the WHOLE pattern: dragging the first
      // occurrence from Monday to Tuesday shifts every generated slot by the
      // same day distance (Mon/Wed/Fri/Sun → Tue/Thu/Sat/Mon) and applies the
      // new time of day. A same-day move is a pure clock change (dayDelta 0),
      // which keeps the previous behaviour.
      const dayDelta = wallClockDayDelta(
        parseRfcStamp(parsedId.recurrenceId).date,
        nextStartDate,
        timeZone,
      )
      const anchorStart = addWallClockDays(
        shiftToAnchorClock(prevStartDate, nextStartDate, timeZone),
        dayDelta,
        timeZone,
      )
      submittedFields.startDate = anchorStart
      if (
        submittedFields.endDate !== null &&
        submittedFields.endDate !== undefined
      ) {
        const duration =
          (submittedFields.endDate as Date).getTime() - nextStartDate.getTime()
        submittedFields.endDate = new Date(anchorStart.getTime() + duration)
      }
      let rrule =
        body.rrule !== undefined ? (rawRrule ?? null) : masterRow.rrule
      // Refuse rather than silently degrade: some patterns ("last day of the
      // month", BYWEEKNO with a partial-week shift) have no shifted rule that
      // selects the same occurrences. Writing an approximation would delete or
      // invent occurrences behind the user's back.
      if (
        rrule !== null &&
        dayDelta !== 0 &&
        !canTranslateRuleByDays(rrule, dayDelta)
      ) {
        return NextResponse.json(
          {
            error:
              "This repeat rule cannot be moved to another day with 'all events'. Edit the repeat rule, or use 'this event' / 'this and following'.",
          },
          { status: 400 },
        )
      }
      if (rrule !== null) {
        rrule =
          dayDelta !== 0
            ? translateRuleByDays(
                rrule,
                dayDelta,
                anchorStart,
                allDay,
                timeZone,
              )
            : rrule
        rrule = adaptRuleToStart(
          rrule,
          prevStartDate,
          anchorStart,
          allDay,
          timeZone,
        )
      }
      const remappedExdate =
        dayDelta !== 0
          ? translateStampsByDays(
              masterRow.exdate,
              dayDelta,
              nextStartDate,
              timeZone,
            )
          : shiftExdates(masterRow.exdate, nextStartDate, timeZone)
      const set = {
        ...encryptMergedFields(masterRow.id, submittedFields),
        ...(rrule !== null ? { rrule } : {}),
        ...(body.exdate !== undefined
          ? { exdate: body.exdate }
          : remappedExdate !== null
            ? { exdate: remappedExdate }
            : {}),
        updatedAt: new Date(),
      }
      // See the master-'all' branch: the master's move and the overrides' re-stamps
      // commit or roll back together, so a failure can never leave the series
      // and its overrides disagreeing about where the occurrences are.
      const [updated] = await getDb().transaction(async (tx) => {
        const [row] = await tx
          .update(calendarEvents)
          .set(set)
          .where(
            and(
              eq(calendarEvents.id, masterRow.id),
              eq(calendarEvents.userId, user.id),
            ),
          )
          .returning()
        await remapSeriesOverrideStamps(
          tx,
          user.id,
          masterRow.id,
          nextStartDate,
          timeZone,
          dayDelta,
        )
        return [row]
      })
      await invalidateEventCache(
        user.id,
        masterRow.startDate.toISOString(),
        masterRow.endDate.toISOString(),
      )
      const updatedRow = decryptEvent(updated) as unknown as EventRow
      const [withInvites] = await enrichEventsWithInvites(
        [updatedRow],
        user.id,
        user.email,
      )
      const seriesEvents = await loadSeriesView(user, [updatedRow.id], timeZone)
      return NextResponse.json({ event: withInvites, seriesEvents })
    }

    const now = new Date()
    const plan = planInstanceChange({
      master: masterRow,
      override,
      overrides,
      recurrenceId: parsedId.recurrenceId,
      applyTo,
      fields: { ...submittedFields, rrule: rawRrule },
      now,
      timeZone,
    })

    if (plan.split) {
      const newSeries = plan.split.newSeries
      if (
        typeof body.split_id === 'string' &&
        /^[0-9a-f-]{36}$/i.test(body.split_id)
      ) {
        newSeries.id = body.split_id
      }
      // The tail's new series and the moved overrides' re-stamps are one unit:
      // an override stamped for the old series' clock matches no occurrence of
      // the new one and resurfaces as an orphan duplicate.
      const newMaster = await getDb().transaction(async (tx) => {
        const created = await applySplitPlan(user.id, plan, masterRow, {
          db: tx,
          timeZone,
        })
        if (!created) return null
        await shiftOverrideStamps(
          tx,
          user.id,
          plan.split!.moveOverrideIds,
          new Date(newSeries.startDate),
          timeZone,
        )
        return created
      })
      if (!newMaster)
        return NextResponse.json(
          { error: 'Failed to split series' },
          { status: 500 },
        )
      const seriesEvents = await loadSeriesView(
        user,
        [newMaster.id, masterRow.id],
        timeZone,
      )
      // The truncated old series may expand to zero instances inside the
      // window (e.g. a root-instance split), in which case seriesEvents
      // carries no trace of it — tell the client which series to purge so
      // the old instances cannot linger as ghosts.
      return NextResponse.json({
        event: newMaster,
        seriesEvents,
        removedSeriesIds: [masterRow.id],
      })
    }

    // Exdate write + override upsert are one atomic unit: an exdate without
    // its override silently deletes the instance; an override without the
    // exdate duplicates it.
    const upsert = plan.overrideUpsert!
    const stored = await getDb().transaction(async (tx) => {
      if (plan.exdateToAdd) {
        await tx
          .update(calendarEvents)
          .set({
            exdate: [...(masterRow.exdate ?? []), plan.exdateToAdd],
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(calendarEvents.id, masterRow.id),
              eq(calendarEvents.userId, user.id),
            ),
          )
      }

      return writeInstanceOverride(tx, user.id, upsert)
    })

    await invalidateEventCache(
      user.id,
      masterRow.startDate.toISOString(),
      masterRow.endDate.toISOString(),
    )

    const storedDecrypted = stored
      ? (decryptEvent(stored) as unknown as EventRow)
      : null
    const resolved = resolveInstance(
      masterRow,
      parsedId.recurrenceId,
      storedDecrypted ? [storedDecrypted, ...overrides] : overrides,
    )
    const [withInvites] = await enrichEventsWithInvites(
      [
        resolved
          ? { ...resolved, id, instanceId: id }
          : { ...masterRow, id, instanceId: id },
      ],
      user.id,
      user.email,
    )
    return NextResponse.json({ event: withInvites })
  }

  // One unfiltered read, reused for both the authorisation decision and the
  // merge base. The row has to be visible even when it belongs to somebody
  // else — the 403 depends on seeing the foreign `userId`, and a
  // userId-scoped read would instead fall through to the create path and
  // upsert over a stranger's row. What closes the check-then-act window is the
  // `targetWhere` on the upsert further down: if the row is deleted and
  // recreated under a different owner between this read and that write, the
  // conflict target no longer matches and nothing is overwritten. Previously
  // this read the row, compared owners in JS, then re-read it unfiltered and
  // upserted on `id` alone.
  const [old] = await getDb()
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.id, id))

  if (old && old.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (old) {
    await invalidateEventCache(
      user.id,
      old.startDate.toISOString(),
      old.endDate.toISOString(),
    )
  }

  const fullOld = isUpdate ? old : undefined

  if (isUpdate && fullOld && fullOld.seriesId !== null) {
    const overrideRow = decryptEvent(fullOld) as unknown as EventRow
    const merged = mergeOverride<EventRow>(overrideRow, submittedFields)
    const [updated] = await getDb()
      .update(calendarEvents)
      .set({
        ...encryptMergedFields(
          overrideRow.id,
          merged as unknown as Record<string, unknown>,
        ),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(calendarEvents.id, overrideRow.id),
          eq(calendarEvents.userId, user.id),
        ),
      )
      .returning()
    if (overrideRow.seriesId !== null) {
      await invalidateMasterCache(user.id, overrideRow.seriesId)
    }
    const [withInvites] = await enrichEventsWithInvites(
      [decryptEvent(updated)],
      user.id,
      user.email,
    )
    return NextResponse.json({ event: withInvites })
  }

  if (isUpdate && fullOld && isSeriesEvent({ rrule: fullOld.rrule })) {
    const seriesRow = decryptEvent(fullOld) as unknown as EventRow
    const applyTo = body.apply_to ?? 'all'

    if (applyTo === 'all') {
      const prevStartDate = seriesRow.startDate
      const nextStartDate = submittedFields.startDate as Date
      const allDay = submittedFields.isAllDay ?? seriesRow.isAllDay
      // Master-id edits move the anchor itself; when the move crosses days
      // the whole pattern travels with it (Mon/Wed/Fri/Sun → Tue/Thu/Sat/Mon),
      // matching the instance-'all' semantic.
      const dayDelta = wallClockDayDelta(prevStartDate, nextStartDate, timeZone)
      let rrule =
        body.rrule !== undefined ? (rawRrule ?? null) : seriesRow.rrule
      // See the instance-'all' branch: refuse a day move the rule cannot
      // express instead of writing an approximation.
      if (
        rrule !== null &&
        dayDelta !== 0 &&
        !canTranslateRuleByDays(rrule, dayDelta)
      ) {
        return NextResponse.json(
          {
            error:
              "This repeat rule cannot be moved to another day with 'all events'. Edit the repeat rule, or use 'this event' / 'this and following'.",
          },
          { status: 400 },
        )
      }
      if (rrule !== null) {
        rrule =
          dayDelta !== 0
            ? translateRuleByDays(
                rrule,
                dayDelta,
                nextStartDate,
                allDay,
                timeZone,
              )
            : rrule
        rrule = adaptRuleToStart(
          rrule,
          prevStartDate,
          nextStartDate,
          allDay,
          timeZone,
        )
      }
      // Same invariant as the instance-'all' branch: stored exdate stamps
      // must follow the series into the new clock (and day) space or
      // single-deleted occurrences silently resurrect.
      const remappedExdate =
        dayDelta !== 0
          ? translateStampsByDays(
              seriesRow.exdate,
              dayDelta,
              nextStartDate,
              timeZone,
            )
          : shiftExdates(seriesRow.exdate, nextStartDate, timeZone)
      const set = {
        ...encryptMergedFields(seriesRow.id, submittedFields),
        ...(rrule !== null ? { rrule } : {}),
        ...(body.exdate !== undefined
          ? { exdate: body.exdate }
          : remappedExdate !== null
            ? { exdate: remappedExdate }
            : {}),
        updatedAt: new Date(),
      }
      // The master's move and its overrides' re-stamps are one unit. Overrides
      // are matched to occurrences by stamp, so a master that moved while some
      // overrides kept the old stamps leaves those overrides pointing at slots
      // the series no longer generates — orphan duplicates, exactly what the
      // remap exists to prevent.
      const [updated] = await getDb().transaction(async (tx) => {
        const [row] = await tx
          .update(calendarEvents)
          .set(set)
          .where(
            and(
              eq(calendarEvents.id, seriesRow.id),
              eq(calendarEvents.userId, user.id),
            ),
          )
          .returning()
        if (nextStartDate.getTime() !== prevStartDate.getTime()) {
          await remapSeriesOverrideStamps(
            tx,
            user.id,
            seriesRow.id,
            nextStartDate,
            timeZone,
            dayDelta,
          )
        }
        return [row]
      })
      await invalidateEventCache(
        user.id,
        seriesRow.startDate.toISOString(),
        seriesRow.endDate.toISOString(),
      )
      const updatedRow = decryptEvent(updated) as unknown as EventRow
      const [withInvites] = await enrichEventsWithInvites(
        [updatedRow],
        user.id,
        user.email,
      )
      const seriesEvents = await loadSeriesView(user, [updatedRow.id], timeZone)
      return NextResponse.json({ event: withInvites, seriesEvents })
    }

    const recurrenceId = resolveMasterEditStamp(seriesRow, timeZone)
    const overrides = (await fetchOverrides(seriesRow.id)).map((o) =>
      decryptEvent(o as typeof calendarEvents.$inferSelect),
    )
    const override =
      overrides.find((o) => o.recurrenceId === recurrenceId) ?? null
    const plan = planInstanceChange({
      master: seriesRow,
      override,
      overrides,
      recurrenceId,
      applyTo,
      fields: { ...submittedFields, rrule: rawRrule },
      now: new Date(),
      timeZone,
    })

    if (plan.split) {
      const newSeries = plan.split.newSeries
      if (
        typeof body.split_id === 'string' &&
        /^[0-9a-f-]{36}$/i.test(body.split_id)
      ) {
        newSeries.id = body.split_id
      }
      const newMaster = await getDb().transaction(async (tx) => {
        const created = await applySplitPlan(user.id, plan, seriesRow, {
          db: tx,
          timeZone,
        })
        if (!created) return null
        await shiftOverrideStamps(
          tx,
          user.id,
          plan.split!.moveOverrideIds,
          new Date(newSeries.startDate),
          timeZone,
        )
        return created
      })
      if (!newMaster)
        return NextResponse.json(
          { error: 'Failed to split series' },
          { status: 500 },
        )
      const seriesEvents = await loadSeriesView(
        user,
        [newMaster.id, seriesRow.id],
        timeZone,
      )
      // See the instance-branch split above: the truncated old series can
      // vanish from seriesEvents, so name it explicitly for client purging.
      return NextResponse.json({
        event: newMaster,
        seriesEvents,
        removedSeriesIds: [seriesRow.id],
      })
    }

    if (plan.exdateToAdd) {
      await getDb()
        .update(calendarEvents)
        .set({
          exdate: [...(seriesRow.exdate ?? []), plan.exdateToAdd],
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(calendarEvents.id, seriesRow.id),
            eq(calendarEvents.userId, user.id),
          ),
        )
    }

    const upsert = plan.overrideUpsert!
    const encryptedOverride = encryptMergedFields(upsert.id, upsert.fields)
    let stored
    if (upsert.isNew) {
      ;[stored] = await getDb()
        .insert(calendarEvents)
        .values({
          id: upsert.id,
          userId: user.id,
          seriesId: upsert.seriesId,
          recurrenceId: upsert.recurrenceId,
          createdAt: upsert.fields.createdAt as Date,
          updatedAt: upsert.fields.updatedAt as Date,
          ...encryptedOverride,
        } as typeof calendarEvents.$inferInsert)
        .returning()
    } else {
      ;[stored] = await getDb()
        .update(calendarEvents)
        .set({ ...encryptedOverride, updatedAt: new Date() })
        .where(
          and(
            eq(calendarEvents.id, upsert.id),
            eq(calendarEvents.userId, user.id),
          ),
        )
        .returning()
    }

    await invalidateEventCache(
      user.id,
      seriesRow.startDate.toISOString(),
      seriesRow.endDate.toISOString(),
    )

    const storedDecrypted = stored
      ? (decryptEvent(stored) as unknown as EventRow)
      : null
    const resolved = resolveInstance(
      seriesRow,
      recurrenceId,
      storedDecrypted ? [storedDecrypted, ...overrides] : overrides,
    )
    const [withInvites] = await enrichEventsWithInvites(
      [
        resolved
          ? { ...resolved, id, instanceId: id }
          : { ...seriesRow, id, instanceId: id },
      ],
      user.id,
      user.email,
    )
    return NextResponse.json({ event: withInvites })
  }

  let upsertRrule = rawRrule
  if (upsertRrule !== null && isUpdate && fullOld && fullOld.rrule === null) {
    const prevStart = new Date(fullOld.startDate)
    const nextStart = new Date(body.startDate)
    if (prevStart.getTime() !== nextStart.getTime()) {
      upsertRrule = adaptRuleToStart(
        upsertRrule,
        prevStart,
        nextStart,
        body.isAllDay ?? false,
        timeZone,
      )
    }
  }

  const [event] = await getDb()
    .insert(calendarEvents)
    .values({
      id,
      userId: user.id,
      title: encryptField(id, body.title) ?? '',
      description: encryptField(id, body.description),
      location: encryptField(id, body.location),
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      isAllDay: body.isAllDay ?? false,
      status: body.status ?? 'confirmed',
      color: body.color ?? null,
      categoryId: body.categoryId ?? null,
      participants: encryptJsonField(id, body.participants),
      notificationMinutes: body.notificationMinutes ?? null,
      emailReminder: body.emailReminder ?? false,
      rrule: upsertRrule,
      exdate: body.exdate ?? null,
    })
    .onConflictDoUpdate({
      target: calendarEvents.id,
      // An update may only ever touch a row the caller still owns. Every other
      // id-scoped write in the app carries `eq(userId, …)` in the statement
      // itself (categories, countdowns, the invite PATCH); this is where the
      // event write makes that guarantee stick rather than relying on the
      // check-then-act above.
      targetWhere: eq(calendarEvents.userId, user.id),
      set: {
        title: encryptField(id, body.title) ?? '',
        description: encryptField(id, body.description),
        location: encryptField(id, body.location),
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        isAllDay: body.isAllDay ?? false,
        status: body.status ?? 'confirmed',
        color: body.color ?? null,
        categoryId: body.categoryId ?? null,
        participants: encryptJsonField(id, body.participants),
        notificationMinutes: body.notificationMinutes ?? null,
        emailReminder: body.emailReminder ?? false,
        rrule: upsertRrule,
        exdate: body.exdate ?? null,
        updatedAt: new Date(),
      },
    })
    .returning()

  await invalidateEventCache(user.id, body.startDate, body.endDate)

  // The event editor creates a Meeting the moment the organiser asks for one,
  // before this row exists, so its link is copyable immediately. Such a row is
  // provisional (it expires) until the event it points at actually saves — which
  // is here. Committed server-side rather than by a follow-up call from the
  // client: a client that crashes or loses the network between saving the event
  // and confirming the meeting would otherwise leave a real Event Meeting
  // quietly expiring. Idempotent and organiser-scoped, and a no-op for the
  // events that have no meeting. Never fails the save — the event is written.
  try {
    await commitMeetingForEvent(getDb(), id, user.id)
  } catch (error) {
    console.error(
      '[calendar:events] committing the event meeting failed',
      error,
    )
  }

  const createdRow = decryptEvent(event)
  if (upsertRrule !== null) {
    const seriesEvents = await loadSeriesView(user, [createdRow.id], timeZone)
    return NextResponse.json({ event: createdRow, seriesEvents })
  }
  const [withMeeting] = await enrichEventsWithInvites(
    [{ ...createdRow, instanceId: createdRow.id }],
    user.id,
    user.email,
  )
  // The response is what the SWR cache is patched with, so it must carry the
  // meeting or the preview would show none until the next full refetch — the
  // "no link until you refresh" bug.
  return NextResponse.json({ event: withMeeting })
}

const deleteHandler = async function DELETE(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (body === null || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { id } = body as { id?: string }
  const timezone = (body as { timezone?: string }).timezone
  const timeZone = await resolveUserTz(user.id, timezone)
  const apply_to = body.apply_to as ApplyTo | null | undefined
  if (!id)
    return NextResponse.json({ error: 'Missing event id' }, { status: 400 })
  if (
    apply_to !== null &&
    apply_to !== undefined &&
    !APPLY_TO_VALUES.has(apply_to)
  ) {
    return NextResponse.json({ error: 'Invalid apply_to' }, { status: 400 })
  }

  const parsedId = isInstanceId(id) ? parseInstanceId(id) : null

  if (parsedId) {
    const [master] = await getDb()
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.id, parsedId.seriesId),
          eq(calendarEvents.userId, user.id),
        ),
      )
    if (
      !master ||
      !isSeriesEvent({
        rrule: master.rrule,
      })
    ) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    const masterRow = decryptEvent(master) as unknown as EventRow
    const overrides = await fetchOverrides(masterRow.id)
    const override =
      overrides.find((o) => o.recurrenceId === parsedId.recurrenceId) ?? null
    const applyTo = apply_to ?? 'single'

    if (applyTo === 'all') {
      await deleteRow(user.id, masterRow)
      const seriesEvents = await loadSeriesView(user, [masterRow.id], timeZone)
      return NextResponse.json({ success: true, seriesEvents })
    }

    if (applyTo === 'single') {
      if (override) {
        // Override delete + master exdate are one atomic unit: dropping the
        // override without the exdate resurrects the base occurrence.
        await getDb().transaction(async (tx) => {
          await deleteRow(user.id, override, tx)
          await tx
            .update(calendarEvents)
            .set({
              exdate: [
                ...new Set([
                  ...(masterRow.exdate ?? []),
                  parsedId.recurrenceId,
                ]),
              ],
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(calendarEvents.id, masterRow.id),
                eq(calendarEvents.userId, user.id),
              ),
            )
        })
        await invalidateEventCache(
          user.id,
          masterRow.startDate.toISOString(),
          masterRow.endDate.toISOString(),
        )
      } else {
        await getDb()
          .update(calendarEvents)
          .set({
            exdate: [
              ...new Set([...(masterRow.exdate ?? []), parsedId.recurrenceId]),
            ],
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(calendarEvents.id, masterRow.id),
              eq(calendarEvents.userId, user.id),
            ),
          )
        await invalidateEventCache(
          user.id,
          masterRow.startDate.toISOString(),
          masterRow.endDate.toISOString(),
        )
      }
      return NextResponse.json({ success: true })
    }

    const plan = planInstanceChange({
      master: masterRow,
      override,
      overrides,
      recurrenceId: parsedId.recurrenceId,
      applyTo: 'following',
      fields: {},
      now: new Date(),
      timeZone,
    })
    const newMaster = await applySplitPlan(user.id, plan, masterRow, {
      timeZone,
    })
    if (newMaster) {
      // Through deleteRow, never a bare delete: the split just re-pointed the
      // Series' Meeting at this new master (ADR-0019), and the meeting cascade
      // lives in deleteRow. Deleting the row directly left a joinable room
      // attached to an event that no longer exists.
      await deleteRow(user.id, newMaster as unknown as EventRow)
    }
    const seriesEvents = await loadSeriesView(user, [masterRow.id], timeZone)
    return NextResponse.json({ success: true, seriesEvents })
  }

  const [old] = await getDb()
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, user.id)))

  if (!old)
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  if (old.seriesId !== null) {
    await deleteRow(user.id, old as unknown as EventRow)
    await invalidateMasterCache(user.id, old.seriesId)
    return NextResponse.json({ success: true })
  }

  if (isSeriesEvent({ rrule: old.rrule })) {
    const seriesRow = decryptEvent(old) as unknown as EventRow
    const applyTo = apply_to ?? 'all'

    if (applyTo === 'all') {
      await deleteRow(user.id, seriesRow)
      const seriesEvents = await loadSeriesView(user, [seriesRow.id], timeZone)
      return NextResponse.json({ success: true, seriesEvents })
    }

    const recurrenceId = resolveMasterEditStamp(seriesRow, timeZone)
    const overrides = await fetchOverrides(seriesRow.id)
    const override =
      overrides.find((o) => o.recurrenceId === recurrenceId) ?? null
    const plan = planInstanceChange({
      master: seriesRow,
      override,
      overrides,
      recurrenceId,
      applyTo,
      fields: {},
      now: new Date(),
      timeZone,
    })

    if (plan.split) {
      const newMaster = await applySplitPlan(user.id, plan, seriesRow, {
        timeZone,
      })
      if (newMaster) {
        // See above: deleteRow carries the meeting cascade.
        await deleteRow(user.id, newMaster as unknown as EventRow)
      }
      const seriesEvents = await loadSeriesView(user, [seriesRow.id], timeZone)
      return NextResponse.json({ success: true, seriesEvents })
    }

    // Mirror the instance-id 'single' branch: delete the override row (its
    // invites are removed inside deleteRow), then exdate the occurrence. If
    // the override survived, the engine would re-render the deleted first
    // instance as a ghost. Both writes are one atomic unit.
    await getDb().transaction(async (tx) => {
      if (override) {
        await deleteRow(user.id, override, tx)
      }
      await tx
        .update(calendarEvents)
        .set({
          exdate: [...new Set([...(seriesRow.exdate ?? []), recurrenceId])],
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(calendarEvents.id, seriesRow.id),
            eq(calendarEvents.userId, user.id),
          ),
        )
    })
    await invalidateEventCache(
      user.id,
      seriesRow.startDate.toISOString(),
      seriesRow.endDate.toISOString(),
    )
    const seriesEvents = await loadSeriesView(user, [seriesRow.id], timeZone)
    return NextResponse.json({ success: true, seriesEvents })
  }

  await deleteRow(user.id, old as unknown as EventRow)
  return NextResponse.json({ success: true })
}

/**
 * Reconciles the event's scheduled reminder emails after a successful mutation.
 *
 * Wrapping is deliberate: POST alone has eight success returns, and a reminder
 * left scheduled for a deleted or moved event emails the user about something
 * that no longer exists. Doing this once at the boundary is the only way to be
 * sure no path is missed. See
 * ADR-0010 (email reminders are opt-in per event and scheduled through Resend).
 */
async function withReminderReconciliation(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<NextResponse>,
): Promise<NextResponse> {
  // The body is read by the handler, so clone before it is consumed.
  const peek = await request
    .clone()
    .json()
    .catch(() => null)

  const user = await getAuthedUser()
  const rawId = (peek as { id?: unknown } | null)?.id
  const roots = new Set<string>()
  if (typeof rawId === 'string') {
    roots.add(parseInstanceId(rawId)?.seriesId ?? rawId)
    if (user && !isInstanceId(rawId)) {
      const [before] = await getDb()
        .select({ seriesId: calendarEvents.seriesId })
        .from(calendarEvents)
        .where(
          and(eq(calendarEvents.id, rawId), eq(calendarEvents.userId, user.id)),
        )
      if (before?.seriesId) roots.add(before.seriesId)
    }
  }

  const response = await handler(request)
  if (response.status < 200 || response.status >= 300) return response

  if (!user) return response
  const body = await response
    .clone()
    .json()
    .catch(() => ({}))
  if (body.event?.id)
    roots.add(
      body.event.seriesId ??
        parseInstanceId(body.event.id)?.seriesId ??
        body.event.id,
    )
  for (const event of body.seriesEvents ?? []) {
    if (typeof event.id === 'string')
      roots.add(
        event.seriesId ?? parseInstanceId(event.id)?.seriesId ?? event.id,
      )
  }

  try {
    const { reconcileEventReminders, SendQuotaExceeded } =
      await import('@/lib/reminders/reconcile')
    const wantsEmail = (peek as { emailReminder?: unknown } | null)
      ?.emailReminder
    try {
      for (const eventId of roots)
        await reconcileEventReminders({
          userId: user.id,
          eventId,
          // A quota refusal is only worth surfacing when the user just asked for
          // email reminders; on unrelated edits it is noise.
          strictQuota: wantsEmail === true,
        })
    } catch (error) {
      if (error instanceof SendQuotaExceeded) {
        // The event was saved. Report the refusal alongside it rather than
        // failing the save — see ADR-0010.
        return NextResponse.json(
          { ...body, reminderWarning: error.message },
          { status: response.status },
        )
      }
      throw error
    }
  } catch {
    // A provider or database failure here must never fail the event mutation.
    // The top-up cron retries.
  }

  return response
}

export const POST = (request: NextRequest) =>
  withReminderReconciliation(request, postHandler)

export const DELETE = (request: NextRequest) =>
  withReminderReconciliation(request, deleteHandler)
