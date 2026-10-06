import { getDb } from '@/lib/drizzle/client'
import {
  calendarEvents,
  calendarCategories,
  eventInvites,
} from '@/lib/drizzle/schema'
import { eq, and, lt, gt, inArray, or, isNotNull, type SQL } from 'drizzle-orm'
import { encryptField } from '@/lib/field-crypto'
import { decryptEvent } from '@/lib/api-helpers'
import { deleteMeetingsForEvent, moveMeetingToEvent } from '@zntr/meetings'
import { normalizeColor } from './colors'
import {
  EVENT_COLOR_VALUES,
  PALETTE_TO_EVENT_COLOR,
} from '@zntr/calendar-ui/lib/event-colors'
import { InvalidEventQueryError, ParticipantError } from './errors'
import { getSettings } from './settings-tools'
import { invalidateEventCache } from '@/lib/cache/events'
import {
  expandRows,
  resolveMasterEditStamp,
  mergeOverride,
  planInstanceChange,
  resolveInstance,
  type ApplyTo,
  type EventRow,
  type InstanceChangePlan,
} from '@/lib/event-service'
import {
  adaptRuleToStart,
  addWallClockDays,
  canTranslateRuleByDays,
  firstVisibleStampOfSeries,
  isInstanceId,
  isSeriesEvent,
  parseInstanceId,
  parseRfcStamp,
  shiftExdates,
  shiftToAnchorClock,
  translateRuleByDays,
  translateStampsByDays,
  wallClockDayDelta,
  weekdayIndexInTz,
  withUntil,
  partsInTz,
  tzOffsetMs,
} from '@zntr/calendar-ui/lib/recurrence/engine'
import { isValidTimezone } from '@zntr/calendar-ui/lib/timezone'
import { carryInvitesAcrossSplit } from '@/lib/invites/split-carry'
import {
  baselineOf,
  getOccurrencesForInvites,
} from '@/lib/invites/invite-service'
import { canParticipantSeeOccurrence } from '@/lib/invites/visibility'
import { normalizeEmails as normalizeEmailsShared } from '@zntr/calendar-ui/lib/email'
import {
  encryptMergedFields,
  isValidRrule,
  isValidStamp,
  remapSeriesOverrideStamps,
  shiftOverrideStamps,
  writeInstanceOverride,
} from '@/lib/event-write'
import crypto from 'crypto'

export type EventStatus = 'confirmed' | 'tentative' | 'cancelled'
const EVENT_STATUSES: EventStatus[] = ['confirmed', 'tentative', 'cancelled']

export type TimePreset =
  | 'today'
  | 'this_week'
  | 'next_week'
  | 'upcoming'
  | 'past'
type EventSortField = 'start_date' | 'end_date' | 'created_at' | 'updated_at'
type EventSearchField = 'title' | 'description' | 'location'
export type ParticipantMode = 'any' | 'all'

const EVENT_FIELD_WHITELIST = [
  'id',
  'title',
  'description',
  'location',
  'startDate',
  'endDate',
  'isAllDay',
  'color',
  'categoryId',
  'participants',
  'notificationMinutes',
  'status',
  'createdAt',
  'updatedAt',
  'rrule',
  'exdate',
  'seriesId',
  'recurrenceId',
] as const

const EVENT_FIELD_ALIASES: Record<string, string> = {
  start_date: 'startDate',
  end_date: 'endDate',
  is_all_day: 'isAllDay',
  category_id: 'categoryId',
  notification_minutes: 'notificationMinutes',
  email_reminder: 'emailReminder',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  series_id: 'seriesId',
  recurrence_id: 'recurrenceId',
}

export interface ListEventsParams {
  /** Internal AI scan; do not discard candidates by lexical relevance. */
  searchCandidates?: boolean
  // Compatible legacy parameters.
  start_date?: string
  end_date?: string
  query?: string
  page?: number
  limit?: number

  filter?: {
    time?: {
      start?: string
      end?: string
      preset?: TimePreset
      timezone?: string
    }
    category_ids?: string[]
    colors?: string[]
    status?: EventStatus[]
    is_all_day?: boolean
    participants?: {
      emails?: string[]
      /**
       * Display names to match, case-insensitively, against the stored
       * participant names and the local part of their addresses. This exists
       * because "the meeting with Alex" is how people speak and an address is
       * not: the semantic-search model is given the user's own words and must
       * never invent an address to search with.
       */
      names?: string[]
      mode?: ParticipantMode
      exists?: boolean
    }
  }

  search?: {
    text: string
    fields?: EventSearchField[]
  }

  sort?: {
    field: EventSortField
    direction?: 'asc' | 'desc'
  }

  fields?: string[]

  pagination?: {
    page?: number
    limit?: number
  }
}

const MAX_PAGE_LIMIT = 100

// ---------------------------------------------------------------------------
// Pure helpers (unit-testable)
// ---------------------------------------------------------------------------

/**
 * The calendar date `date` falls on in `timeZone`.
 *
 * The zone is a caller-supplied tool argument, so an unrecognised one has to
 * come back as a query error rather than a silent wrong answer — the engine's
 * primitives throw `RangeError` from the `Intl` constructor, which is what this
 * converts.
 */
function localDateParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  try {
    const p = partsInTz(date, timeZone)
    return { year: p.year, month: p.month, day: p.day }
  } catch {
    throw new InvalidEventQueryError(`Invalid timezone: ${timeZone}`)
  }
}

/**
 * Days from the Monday of `date`'s week, in the zone's calendar.
 */
function daysFromMonday(date: Date, timeZone: string): number {
  try {
    return (weekdayIndexInTz(date, timeZone) + 6) % 7
  } catch {
    throw new InvalidEventQueryError(`Invalid timezone: ${timeZone}`)
  }
}

/**
 * Midnight at the start of `date`'s local day, as an instant.
 *
 * The offset is read twice on purpose. Reading it once at the wall-clock value
 * read as if it were UTC — which is what the recurrence engine's
 * `wallClockToInstant` does — is correct except when a DST transition falls
 * between that guess and the true instant. Resolving it a second time at the
 * first guess's result closes that window, and it is why this iteration is not
 * folded into `wallClockToInstant`: the two serve different ranges, and
 * collapsing them would quietly move weekly boundaries by an hour twice a year.
 */
function localMidnightInTz(date: Date, timeZone: string): Date {
  const { year, month, day } = localDateParts(date, timeZone)
  const naive = Date.UTC(year, month - 1, day)
  const firstGuess = naive - offsetAt(timeZone, date.getTime())
  return new Date(naive - offsetAt(timeZone, firstGuess))
}

/** The zone's offset at an instant, with an unrecognised zone as a query error. */
function offsetAt(timeZone: string, utcMs: number): number {
  try {
    return tzOffsetMs(timeZone, utcMs)
  } catch {
    throw new InvalidEventQueryError(`Invalid timezone: ${timeZone}`)
  }
}

function mondayOfWeek(date: Date, timeZone: string): Date {
  const days = daysFromMonday(date, timeZone)
  return localMidnightInTz(
    new Date(date.getTime() - days * 24 * 60 * 60 * 1000),
    timeZone,
  )
}

function parseDate(value: string, label: string): Date {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new InvalidEventQueryError(`Invalid ${label}: ${value}`)
  }
  return parsed
}

export interface ResolvedTimeRange {
  start?: Date
  end?: Date
}

export function resolveTimeRange(
  time:
    | {
        start?: string
        end?: string
        preset?: TimePreset
        timezone?: string
        now?: Date
      }
    | undefined,
  defaultTimezone: string,
): ResolvedTimeRange {
  if (!time) return {}

  const { start, end, preset } = time
  const timezone = time.timezone ?? defaultTimezone

  if (preset && (start || end)) {
    throw new InvalidEventQueryError(
      'filter.time.preset cannot be combined with explicit start/end',
    )
  }

  if (!preset) {
    return {
      start: start ? parseDate(start, 'start date') : undefined,
      end: end ? parseDate(end, 'end date') : undefined,
    }
  }

  const now = time.now ?? new Date()

  switch (preset) {
    case 'today': {
      const todayStart = localMidnightInTz(now, timezone)
      const tomorrowStart = localMidnightInTz(
        new Date(todayStart.getTime() + 25 * 60 * 60 * 1000),
        timezone,
      )
      return { start: todayStart, end: tomorrowStart }
    }
    case 'this_week': {
      const weekStart = mondayOfWeek(now, timezone)
      const weekEnd = localMidnightInTz(
        new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000),
        timezone,
      )
      return { start: weekStart, end: weekEnd }
    }
    case 'next_week': {
      const weekStart = mondayOfWeek(now, timezone)
      const nextWeekStart = localMidnightInTz(
        new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000),
        timezone,
      )
      const nextWeekEnd = localMidnightInTz(
        new Date(nextWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000),
        timezone,
      )
      return { start: nextWeekStart, end: nextWeekEnd }
    }
    case 'upcoming':
      return { start: now }
    case 'past':
      return { end: now }
  }
}

/**
 * Duplicates collapse rather than error: writing the whole participant list
 * back onto an event is idempotent, and `add_event_participants` is the tool
 * that treats a repeat as a mistake.
 */
export function normalizeEmails(emails: string[]): string[] {
  return normalizeEmailsShared(emails, {
    invalid: (message) => new InvalidEventQueryError(message),
  })
}

export function colorCandidates(value: string): string[] {
  const trimmed = value.trim()
  const candidates = new Set<string>([trimmed])
  const normalized = normalizeColor(trimmed)
  candidates.add(normalized)
  const paletteMapped = PALETTE_TO_EVENT_COLOR[trimmed]
  if (paletteMapped) candidates.add(paletteMapped)
  const hex = trimmed
    .toLowerCase()
    .replace(/^bg-\[/, '')
    .replace(/\]$/, '')
  if (/^#[0-9a-f]{6}$/.test(hex)) candidates.add(hex)
  return [...candidates].filter(Boolean)
}

export function isValidEventColor(value: string): boolean {
  const trimmed = value.trim()
  if (EVENT_COLOR_VALUES.has(trimmed)) return true
  if (trimmed in PALETTE_TO_EVENT_COLOR) return true
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return true
  if (/^bg-\[#[0-9a-fA-F]{6}\]$/.test(trimmed)) return true
  return normalizeColor(trimmed) !== trimmed
}

export function validatePagination(
  page: number | undefined,
  limit: number | undefined,
  fallbackLimit = 50,
): { page: number; limit: number } {
  const safePage = page ?? 1
  const safeLimit = limit ?? fallbackLimit
  if (!Number.isInteger(safePage) || safePage < 1) {
    throw new InvalidEventQueryError('page must be an integer >= 1')
  }
  if (
    !Number.isInteger(safeLimit) ||
    safeLimit < 1 ||
    safeLimit > MAX_PAGE_LIMIT
  ) {
    throw new InvalidEventQueryError(
      `limit must be an integer between 1 and ${MAX_PAGE_LIMIT}`,
    )
  }
  return { page: safePage, limit: safeLimit }
}

export function validateEventFields(fields?: string[]): void {
  if (!fields || fields.length === 0) return
  const allowed = new Set<string>([
    ...EVENT_FIELD_WHITELIST,
    ...Object.keys(EVENT_FIELD_ALIASES),
  ])
  for (const field of fields) {
    if (!allowed.has(field)) {
      throw new InvalidEventQueryError(
        `Unknown field: ${field}. Allowed fields: ${EVENT_FIELD_WHITELIST.join(', ')}`,
      )
    }
  }
}

export function projectEventFields(
  event: Record<string, unknown>,
  fields?: string[],
): Record<string, unknown> {
  validateEventFields(fields)
  if (!fields || fields.length === 0) return event
  const requested = fields.map((f) => EVENT_FIELD_ALIASES[f] ?? f)
  const wanted = new Set<string>(requested)
  wanted.add('id')
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(event)) {
    if (wanted.has(key)) result[key] = value
  }
  return result
}

export function mergeParticipantEmails(
  stored: unknown,
  inviteEmails: Iterable<string>,
): string[] {
  const seen = new Set<string>()
  const merged: string[] = []
  for (const email of extractParticipantEmails(stored)) {
    if (seen.has(email)) continue
    seen.add(email)
    merged.push(email)
  }
  for (const email of inviteEmails) {
    const normalized = email.trim().toLowerCase()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    merged.push(normalized)
  }
  return merged
}

export function extractParticipantEmails(participants: unknown): string[] {
  if (!Array.isArray(participants)) return []
  const emails: string[] = []
  for (const entry of participants) {
    if (typeof entry === 'string') {
      emails.push(entry.trim().toLowerCase())
    } else if (entry && typeof entry === 'object') {
      const email = (entry as { email?: unknown }).email
      if (typeof email === 'string' && email) {
        emails.push(email.trim().toLowerCase())
      }
    }
  }
  return emails
}

export function matchesParticipantFilter(
  emails: Set<string>,
  emailsFilter:
    | { emails?: string[]; mode?: ParticipantMode; exists?: boolean }
    | undefined,
): boolean {
  if (!emailsFilter) return true
  if (typeof emailsFilter.exists === 'boolean') {
    const hasParticipants = emails.size > 0
    if (emailsFilter.exists && !hasParticipants) return false
    if (!emailsFilter.exists && hasParticipants) return false
  }
  if (!emailsFilter.emails || emailsFilter.emails.length === 0) return true
  const target = emailsFilter.emails.map((e) => e.trim().toLowerCase())
  if (emailsFilter.mode === 'all') {
    return target.every((email) => emails.has(email))
  }
  return target.some((email) => emails.has(email))
}

/**
 * Every string a participant can be called: the stored display name, and the
 * local part of the address for entries that carry only one.
 *
 * The name is stored separately from the address on purpose. Matching on
 * addresses alone means "the meeting with Alex" can only be answered by
 * whoever already knows Alex's address, which is precisely what a half-remembered
 * search does not.
 */
export function extractParticipantNames(participants: unknown): string[] {
  if (!Array.isArray(participants)) return []
  const names: string[] = []
  for (const entry of participants) {
    if (typeof entry === 'string') {
      names.push(localPart(entry))
      continue
    }
    if (entry && typeof entry === 'object') {
      const { name, email } = entry as { name?: unknown; email?: unknown }
      if (typeof name === 'string' && name.trim()) {
        names.push(name.trim().toLowerCase())
      } else if (typeof email === 'string' && email.trim()) {
        names.push(localPart(email))
      }
    }
  }
  return names
}

function localPart(address: string): string {
  return address.trim().toLowerCase().split('@')[0]
}

/**
 * Name matching, deliberately looser than the email match: a substring hit.
 * Users type "Alex" for "Alex Chen" and "wang" for "Wang Fang" without
 * knowing which is which, and a search that answers "nothing found" for a
 * person it clearly could have found is worse than a slightly wide one.
 */
export function matchesParticipantNames(
  names: Set<string>,
  target: string[],
  mode: ParticipantMode | undefined,
): boolean {
  if (target.length === 0) return true
  const needles = target.map((n) => n.trim().toLowerCase()).filter(Boolean)
  if (needles.length === 0) return true
  const hit = (needle: string) =>
    names.size > 0 &&
    [...names].some((name) => name.includes(needle) || needle.includes(name))
  if (mode === 'all') return needles.every(hit)
  return needles.some(hit)
}

// ---------------------------------------------------------------------------
// Recurring events helpers
// ---------------------------------------------------------------------------

function validateRecurringArguments(
  rrule: string | null,
  exdate: string[] | null | undefined,
): void {
  if (rrule !== null && !isValidRrule(rrule)) {
    throw new InvalidEventQueryError(
      'Invalid rrule: must be a valid RFC 5545 RRULE (e.g. FREQ=WEEKLY;INTERVAL=1)',
    )
  }
  if (exdate !== null && exdate !== undefined) {
    if (rrule === null) {
      throw new InvalidEventQueryError('exdate requires rrule')
    }
    for (const stamp of exdate) {
      if (!isValidStamp(stamp)) {
        throw new InvalidEventQueryError(`Invalid exdate: ${stamp}`)
      }
    }
  }
}

function mcpFieldsToEventRow(data: {
  rrule?: string | null
  title?: string
  description?: string | null
  location?: string | null
  start_date?: string
  end_date?: string
  is_all_day?: boolean
  status?: EventStatus | null
  color?: string | null
  category_id?: string | null
  notification_minutes?: number | null
}): Partial<EventRow> {
  const fields: Partial<EventRow> = {}
  if (data.rrule !== undefined) fields.rrule = data.rrule
  if (data.title !== undefined) fields.title = data.title
  if (data.description !== undefined) fields.description = data.description
  if (data.location !== undefined) fields.location = data.location
  if (data.start_date !== undefined)
    fields.startDate = new Date(data.start_date)
  if (data.end_date !== undefined) fields.endDate = new Date(data.end_date)
  if (data.is_all_day !== undefined) fields.isAllDay = data.is_all_day
  if (data.status !== undefined && data.status !== null)
    fields.status = data.status
  if (data.color !== undefined && data.color !== null)
    fields.color = normalizeColor(data.color)
  if (data.category_id !== undefined) fields.categoryId = data.category_id
  if (data.notification_minutes !== undefined)
    fields.notificationMinutes = data.notification_minutes
  return fields
}

/**
 * Drops the cached month buckets a series touches. MCP mutations previously
 * skipped this, so a tool-driven edit left the web UI serving stale months
 * from Redis until the TTL expired. Never throws: a cache miss is safe, a
 * failed tool call is not.
 */
async function invalidateSeriesCache(
  userId: string,
  rows: Array<
    { startDate: Date | string; endDate: Date | string } | null | undefined
  >,
): Promise<void> {
  for (const row of rows) {
    if (!row) continue
    try {
      const start = new Date(row.startDate)
      const end = new Date(row.endDate)
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue
      await invalidateEventCache(userId, start.toISOString(), end.toISOString())
    } catch {
      // Cache invalidation is best-effort.
    }
  }
}

async function resolveUserTimeZone(userId: string): Promise<string> {
  try {
    const settings = (await getSettings(userId)) as Record<string, unknown>
    const tz = settings.timezone
    if (typeof tz !== 'string' || !isValidTimezone(tz)) return 'UTC'
    return tz
  } catch {
    return 'UTC'
  }
}

type BaseDb = Awaited<ReturnType<typeof getDb>>
type TxDb = Parameters<Parameters<BaseDb['transaction']>[0]>[0]
/** Either the singleton connection or a transaction executor — helpers that
 * take this can participate in a caller's transaction unchanged. */
type Db = BaseDb | TxDb

async function deleteCalendarEventRow(
  db: Db,
  userId: string,
  eventId: string,
): Promise<void> {
  await db.delete(eventInvites).where(eq(eventInvites.eventId, eventId))
  // Event Meetings have no database FK back to this table on purpose
  // (ADR-0017), so the cascade is explicit — exactly as the REST route's
  // deleteRow does it. This function is the single delete path behind every MCP
  // delete call site, so omitting it orphaned a joinable room on each one.
  await deleteMeetingsForEvent(db, eventId)
  await db
    .delete(calendarEvents)
    .where(
      and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)),
    )
}

async function fetchSeriesOverrides(
  db: Db,
  seriesId: string,
): Promise<ReturnType<typeof decryptEvent>[]> {
  const rows = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.seriesId, seriesId))
  return rows.map(decryptEvent)
}

async function applySplitPlan(
  userId: string,
  master: EventRow,
  plan: InstanceChangePlan,
  dbx?: Db,
  /**
   * The organiser's timezone, so carried grants are clock-remapped in the same
   * zone the rest of the split's stamp arithmetic uses.
   */
  timeZone?: string,
): Promise<ReturnType<typeof decryptEvent> | null> {
  const db = dbx ?? (await getDb())
  const split = plan.split!
  const newId = split.newSeries.id
  const [newMaster] = await db
    .insert(calendarEvents)
    .values({
      id: newId,
      userId,
      rrule: split.newSeries.rrule,
      exdate: split.newSeries.exdate,
      ...encryptMergedFields(newId, split.newSeries.fields),
    } as typeof calendarEvents.$inferInsert)
    .returning()

  if (plan.deleteOverrideId) {
    await deleteCalendarEventRow(db, userId, plan.deleteOverrideId)
  }

  if (split.moveOverrideIds.length > 0) {
    await db
      .update(calendarEvents)
      .set({ seriesId: newId })
      .where(
        and(
          inArray(calendarEvents.id, split.moveOverrideIds),
          eq(calendarEvents.userId, userId),
        ),
      )
  }

  // Participants must not silently lose the tail of the series just because an
  // agent rescheduled it. Shared with the REST route so the invariant lives in
  // one place — see
  // ADR-0009 (invites and their visibility survive a series split). This runs
  // BEFORE the empty-master delete below, which would otherwise destroy the
  // grants with nothing having been carried.
  await carryInvitesAcrossSplit(db, {
    oldMasterId: master.id,
    newMasterId: newId,
    boundaryStamp: split.masterUntil,
    clockSource: split.newSeries.startDate,
    timeZone,
  })

  // The Series' single Meeting follows the tail, the part participants will
  // actually attend (ADR-0019) — the same unconditional move the REST split
  // does. Must precede the empty-master delete below, whose cascade would
  // otherwise take the meeting with it.
  await moveMeetingToEvent(db, master.id, newId)

  if (split.masterBecomesEmpty) {
    // Same as the REST route: a truncated master that renders nothing is
    // deleted rather than kept as an invisible zombie row.
    await deleteCalendarEventRow(db, userId, master.id)
  } else {
    await db
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

  return decryptEvent(newMaster)
}

async function applySinglePlan(
  db: Db,
  userId: string,
  master: EventRow,
  plan: InstanceChangePlan,
): Promise<ReturnType<typeof decryptEvent> | null> {
  const upsert = plan.overrideUpsert!
  if (plan.exdateToAdd) {
    await db
      .update(calendarEvents)
      .set({
        exdate: [...(master.exdate ?? []), plan.exdateToAdd],
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(calendarEvents.id, master.id),
          eq(calendarEvents.userId, userId),
        ),
      )
  }

  const stored = await writeInstanceOverride(db, userId, upsert)
  return stored ? decryptEvent(stored) : null
}

// ---------------------------------------------------------------------------
// listEvents
// ---------------------------------------------------------------------------

/** One materialization of the user's candidates, before presentation paging. */
export async function listEventCandidates(
  userId: string,
  params: ListEventsParams = {},
) {
  const db = await getDb()

  // New structured parameters take priority over legacy ones.
  const timeFilter = params.filter?.time
  const hasStructuredTime = !!(
    timeFilter?.start ||
    timeFilter?.end ||
    timeFilter?.preset
  )
  const effectiveTimeFilter = hasStructuredTime
    ? timeFilter
    : params.start_date || params.end_date
      ? { start: params.start_date, end: params.end_date }
      : undefined
  const legacyQuery = params.query?.trim()

  const hasStructuredSearch =
    params.search?.text !== undefined && params.search.text.trim() !== ''
  const searchText = hasStructuredSearch
    ? params.search!.text.trim()
    : legacyQuery || undefined
  const searchFields = hasStructuredSearch ? params.search!.fields : undefined

  const defaultTimezone = await resolveUserTimeZone(userId)

  const sqlFilters: SQL[] = [eq(calendarEvents.userId, userId)]

  const timeRange = resolveTimeRange(
    effectiveTimeFilter,
    defaultTimezone ?? 'UTC',
  )
  if (timeRange.start && timeRange.end) {
    sqlFilters.push(lt(calendarEvents.startDate, timeRange.end))
    sqlFilters.push(gt(calendarEvents.endDate, timeRange.start))
  } else if (timeRange.start) {
    sqlFilters.push(gt(calendarEvents.endDate, timeRange.start))
  } else if (timeRange.end) {
    sqlFilters.push(lt(calendarEvents.startDate, timeRange.end))
  }

  if (params.filter?.category_ids && params.filter.category_ids.length > 0) {
    const categoryIds = [...new Set(params.filter.category_ids)]
    const known = await db
      .select({ id: calendarCategories.id })
      .from(calendarCategories)
      .where(
        and(
          eq(calendarCategories.userId, userId),
          inArray(calendarCategories.id, categoryIds),
        ),
      )
    const knownIds = new Set(known.map((c) => c.id))
    const unknown = categoryIds.filter((id) => !knownIds.has(id))
    if (unknown.length > 0) {
      throw new InvalidEventQueryError(
        `Unknown category id(s): ${unknown.join(', ')}`,
      )
    }
    sqlFilters.push(inArray(calendarEvents.categoryId, categoryIds))
  }

  if (params.filter?.colors && params.filter.colors.length > 0) {
    const candidates = new Set<string>()
    for (const color of params.filter.colors) {
      if (!isValidEventColor(color)) {
        throw new InvalidEventQueryError(`Invalid color: ${color}`)
      }
      for (const candidate of colorCandidates(color)) {
        candidates.add(candidate)
      }
    }
    sqlFilters.push(inArray(calendarEvents.color, [...candidates]))
  }

  if (params.filter?.status && params.filter.status.length > 0) {
    for (const status of params.filter.status) {
      if (!EVENT_STATUSES.includes(status)) {
        throw new InvalidEventQueryError(`Invalid status: ${status}`)
      }
    }
    sqlFilters.push(inArray(calendarEvents.status, params.filter.status))
  }

  if (params.filter?.is_all_day !== undefined) {
    sqlFilters.push(eq(calendarEvents.isAllDay, params.filter.is_all_day))
  }

  const participantFilter = params.filter?.participants
  let participantEmails: string[] | undefined
  if (participantFilter?.emails && participantFilter.emails.length > 0) {
    participantEmails = normalizeEmails(participantFilter.emails)
  }
  // Names are matched in memory like the addresses, not in SQL: they live in
  // the encrypted participants jsonb, so SQL cannot see them.
  const participantNames = (participantFilter?.names ?? [])
    .map((name) => name.trim())
    .filter(Boolean)

  const rows = await db
    .select()
    .from(calendarEvents)
    .where(and(...sqlFilters))

  const recurringRows = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.userId, userId),
        or(isNotNull(calendarEvents.rrule), isNotNull(calendarEvents.seriesId)),
      ),
    )

  const recurring = recurringRows.map(decryptEvent)
  const recurringIds = new Set(recurring.map((e) => e.id))
  const plainRows = rows
    .filter((e) => !recurringIds.has(e.id))
    .map(decryptEvent)
  let events = plainRows

  if (timeRange.start || timeRange.end) {
    events = expandRows([...plainRows, ...recurring], {
      windowStart: timeRange.start,
      windowEnd: timeRange.end,
      timezone: defaultTimezone,
    }).map((e) =>
      e.recurrenceId !== null
        ? ({ ...e, id: e.instanceId } as ReturnType<typeof decryptEvent>)
        : (e as ReturnType<typeof decryptEvent>),
    )
  } else {
    // An unbounded semantic lookup searches stored series too. Expanding an
    // infinite rule without a window would invent an arbitrary cutoff; its
    // master remains a navigable result instead of disappearing entirely.
    events = params.searchCandidates ? [...plainRows, ...recurring] : plainRows
  }

  // Recurrence expansion reads masters separately from the SQL-filtered rows.
  // Reapply hard constraints to those results before semantic scoring.
  if (params.searchCandidates) {
    events = events.filter(
      (event) =>
        (!timeRange.start || new Date(event.endDate) > timeRange.start) &&
        (!timeRange.end || new Date(event.startDate) < timeRange.end) &&
        (!params.filter?.category_ids?.length ||
          (event.categoryId !== null &&
            event.categoryId !== undefined &&
            params.filter.category_ids.includes(event.categoryId))),
    )
  }

  // Merge invite emails into participants so returned events show the full
  // participant set, not just the ones stored on the event row.
  const emailSets = await buildParticipantEmailSets(events)
  for (const event of events) {
    const inviteEmails = emailSets.get(event.id)
    if (inviteEmails && inviteEmails.size > 0) {
      event.participants = mergeParticipantEmails(
        event.participants,
        inviteEmails,
      )
    }
  }

  // Full-text search runs after decryption because title/description/location
  // are stored encrypted.
  if (searchText) {
    const fields =
      searchFields && searchFields.length > 0
        ? searchFields
        : (['title', 'description', 'location'] as EventSearchField[])
    const needle = searchText.toLowerCase()
    events = events.filter((event) =>
      fields.some((field) => {
        const value = event[field as 'title' | 'description' | 'location']
        return typeof value === 'string' && value.toLowerCase().includes(needle)
      }),
    )
  }

  if (participantFilter || participantEmails || participantNames.length > 0) {
    const normalizedTarget = participantEmails
    events = events.filter((event) => {
      const emails = new Set(extractParticipantEmails(event.participants))
      // Names are matched off the same decrypted jsonb the emails come from,
      // and invite addresses are already merged in above, so both see the full
      // participant set.
      const names = new Set(extractParticipantNames(event.participants))
      if (normalizedTarget && normalizedTarget.length > 0) {
        const mode = participantFilter?.mode ?? 'any'
        const matches = matchesParticipantFilter(emails, {
          emails: normalizedTarget,
          mode,
        })
        if (!matches) return false
      }
      if (
        participantNames.length > 0 &&
        !matchesParticipantNames(
          names,
          participantNames,
          participantFilter?.mode ?? 'any',
        )
      ) {
        return false
      }
      if (typeof participantFilter?.exists === 'boolean') {
        return matchesParticipantFilter(emails, {
          exists: participantFilter.exists,
        })
      }
      return true
    })
  }

  const fieldKey: Record<EventSortField, keyof (typeof events)[number]> = {
    start_date: 'startDate',
    end_date: 'endDate',
    created_at: 'createdAt',
    updated_at: 'updatedAt',
  }
  const sortField = params.sort?.field ?? 'start_date'
  const sortDirection = params.sort?.direction ?? 'asc'
  if (!(sortField in fieldKey)) {
    throw new InvalidEventQueryError(
      `Unknown sort field: ${sortField}. Allowed: start_date, end_date, created_at, updated_at`,
    )
  }
  if (sortDirection !== 'asc' && sortDirection !== 'desc') {
    throw new InvalidEventQueryError(
      `Invalid sort direction: ${sortDirection}. Use 'asc' or 'desc'`,
    )
  }
  const key = fieldKey[sortField]
  const directionFactor = sortDirection === 'desc' ? -1 : 1
  events.sort((a, b) => {
    const aTime = new Date(a[key] as unknown as string).getTime()
    const bTime = new Date(b[key] as unknown as string).getTime()
    if (aTime !== bTime) return (aTime - bTime) * directionFactor
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })

  return events
}

export async function listEvents(
  userId: string,
  params: ListEventsParams = {},
) {
  const { page, limit } = validatePagination(
    params.pagination?.page ?? params.page,
    params.pagination?.limit ?? params.limit,
  )
  const events = await listEventCandidates(userId, params)

  const total = events.length
  const offset = (page - 1) * limit
  const paged = events.slice(offset, offset + limit)

  const projected = paged.map((event) =>
    projectEventFields(
      event as unknown as Record<string, unknown>,
      params.fields,
    ),
  )

  return {
    events: projected,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

async function buildParticipantEmailSets(
  events: ReturnType<typeof decryptEvent>[],
): Promise<Map<string, Set<string>>> {
  const emailSets = new Map<string, Set<string>>()
  const eventIds = [
    ...new Set(events.map((event) => event.seriesId ?? event.id)),
  ]
  if (eventIds.length === 0) return emailSets

  const invites = await getDb()
    .select({
      id: eventInvites.id,
      eventId: eventInvites.eventId,
      email: eventInvites.email,
      baselineKind: eventInvites.baselineKind,
      fromStamp: eventInvites.fromStamp,
      untilStamp: eventInvites.untilStamp,
    })
    .from(eventInvites)
    .where(inArray(eventInvites.eventId, eventIds))

  const exceptions = await getOccurrencesForInvites(invites.map((i) => i.id))
  const byEvent = new Map<string, typeof invites>()
  for (const invite of invites) {
    const group = byEvent.get(invite.eventId) ?? []
    group.push(invite)
    byEvent.set(invite.eventId, group)
  }
  for (const event of events) {
    const emails = new Set<string>()
    for (const invite of byEvent.get(event.seriesId ?? event.id) ?? []) {
      // Unbounded master results intentionally aggregate the series' invitees.
      // An instance (including a moved override) uses its original stamp.
      if (
        !event.recurrenceId ||
        canParticipantSeeOccurrence(
          baselineOf(invite),
          exceptions.get(invite.id) ?? [],
          event.recurrenceId,
        )
      )
        emails.add(invite.email.toLowerCase())
    }
    emailSets.set(event.id, emails)
  }

  return emailSets
}

export async function getEvent(userId: string, eventId: string) {
  const db = await getDb()
  const parsedId = isInstanceId(eventId) ? parseInstanceId(eventId) : null

  if (parsedId) {
    const [master] = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.id, parsedId.seriesId),
          eq(calendarEvents.userId, userId),
        ),
      )
    if (!master || !isSeriesEvent({ rrule: master.rrule })) return null
    const overrides = (await fetchSeriesOverrides(
      db,
      master.id,
    )) as unknown as EventRow[]
    const resolved = resolveInstance(
      decryptEvent(master) as unknown as EventRow,
      parsedId.recurrenceId,
      overrides,
      await resolveUserTimeZone(userId),
    )
    if (!resolved) return null
    return { ...resolved, id: eventId, instanceId: eventId }
  }

  const [row] = await db
    .select()
    .from(calendarEvents)
    .where(
      and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)),
    )

  if (!row) return null
  return { ...decryptEvent(row), instanceId: row.id }
}

export async function createEvent(
  userId: string,
  data: {
    title: string
    description?: string | null
    location?: string | null
    start_date: string
    end_date: string
    is_all_day?: boolean
    status?: EventStatus
    color: string
    category_id?: string | null
    notification_minutes?: number | null
    email_reminder?: boolean
    rrule?: string | null
    exdate?: string[] | null
  },
) {
  const rawRrule =
    typeof data.rrule === 'string' && data.rrule.trim().length > 0
      ? data.rrule
      : null
  validateRecurringArguments(rawRrule, data.exdate)

  const id = crypto.randomUUID()
  const db = await getDb()

  const [event] = await db
    .insert(calendarEvents)
    .values({
      id,
      userId,
      title: encryptField(id, data.title) ?? '',
      description: encryptField(id, data.description),
      location: encryptField(id, data.location),
      startDate: new Date(data.start_date),
      endDate: new Date(data.end_date),
      isAllDay: data.is_all_day ?? false,
      status: data.status ?? 'confirmed',
      color: normalizeColor(data.color),
      categoryId: data.category_id ?? null,
      notificationMinutes: data.notification_minutes ?? null,
      rrule: rawRrule,
      exdate: data.exdate ?? null,
    })
    .returning()

  const created = decryptEvent(event)
  // Keep the web UI's cached months in step with tool-driven creates.
  await invalidateSeriesCache(userId, [
    { startDate: created.startDate, endDate: created.endDate },
  ])
  // An agent that set email_reminder must actually get scheduled emails, and a
  // quota refusal must reach it — otherwise the checkbox appears set with no
  // emails behind it, and a quota refusal must reach the agent rather than
  // being flattened into a generic error. See ADR-0010.
  await reconcileReminders(userId, created.id, data.email_reminder === true)
  return created
}

async function updateEventImpl(
  userId: string,
  eventId: string,
  data: {
    title?: string
    description?: string | null
    location?: string | null
    start_date?: string
    end_date?: string
    is_all_day?: boolean
    status?: EventStatus | null
    color?: string | null
    category_id?: string | null
    notification_minutes?: number | null
    email_reminder?: boolean
    rrule?: string | null
    exdate?: string[] | null
    apply_to?: ApplyTo
  },
) {
  const db = await getDb()
  const timeZone = await resolveUserTimeZone(userId)
  const rawRrule =
    typeof data.rrule === 'string' && data.rrule.trim().length > 0
      ? data.rrule
      : null
  validateRecurringArguments(rawRrule, data.exdate)
  const fields = mcpFieldsToEventRow(data)
  const parsedId = isInstanceId(eventId) ? parseInstanceId(eventId) : null

  if (parsedId) {
    const [master] = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.id, parsedId.seriesId),
          eq(calendarEvents.userId, userId),
        ),
      )
    if (!master || !isSeriesEvent({ rrule: master.rrule })) return null
    const masterRow = decryptEvent(master) as unknown as EventRow
    const overrides = (await fetchSeriesOverrides(
      db,
      masterRow.id,
    )) as unknown as EventRow[]
    const override =
      overrides.find((o) => o.recurrenceId === parsedId.recurrenceId) ?? null
    const applyTo = data.apply_to ?? 'single'

    // Product rule (mirrors the REST route): "all events" is only allowed
    // from the series' first visible occurrence.
    if (applyTo === 'all') {
      const firstStamp = firstVisibleStampOfSeries(masterRow, timeZone)
      if (firstStamp === null || parsedId.recurrenceId !== firstStamp) {
        throw new Error(
          "apply_to 'all' is only allowed on the series' first occurrence",
        )
      }
    }

    if (applyTo === 'all') {
      // Mirror the REST route's instance-'all' sequence: translate the whole
      // pattern by the move's day distance, adapt the rule, remap stored
      // exdates, then re-stamp overrides — otherwise an MCP "all events"
      // change orphans every single-instance override and resurrects exdated
      // occurrences. Query and mutation use the same organiser timezone.
      const prevStartDate = masterRow.startDate
      const nextStartDate =
        (fields.startDate as Date | undefined) ?? prevStartDate
      const allDay = fields.isAllDay ?? masterRow.isAllDay
      // Cross-day move → the pattern travels (Mon/Wed/Fri/Sun →
      // Tue/Thu/Sat/Mon); same-day move → pure clock change.
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
      if (fields.startDate !== undefined) {
        fields.startDate = anchorStart
        if (fields.endDate !== undefined && fields.endDate !== null) {
          const duration =
            (fields.endDate as Date).getTime() - nextStartDate.getTime()
          fields.endDate = new Date(anchorStart.getTime() + duration)
        }
      }
      let rrule = data.rrule !== undefined ? rawRrule : masterRow.rrule
      // Refuse rather than silently degrade a pattern the shift cannot
      // express (mirrors the REST route).
      if (
        rrule !== null &&
        dayDelta !== 0 &&
        !canTranslateRuleByDays(rrule, dayDelta)
      ) {
        throw new InvalidEventQueryError(
          "This repeat rule cannot be moved to another day with apply_to 'all'. Change the rrule explicitly, or use 'single' / 'following'.",
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
        ...encryptMergedFields(masterRow.id, fields),
        ...(rrule !== null ? { rrule } : {}),
        ...(data.exdate !== undefined
          ? { exdate: data.exdate }
          : remappedExdate !== null
            ? { exdate: remappedExdate }
            : {}),
        updatedAt: new Date(),
      }
      // The master's move and its overrides' re-stamps are one unit, exactly as in
      // the REST handler: overrides are matched to occurrences by stamp, so a
      // master that moved while some overrides kept the old stamps leaves those
      // overrides pointing at slots the series no longer generates.
      const [updated] = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(calendarEvents)
          .set(set)
          .where(
            and(
              eq(calendarEvents.id, masterRow.id),
              eq(calendarEvents.userId, userId),
            ),
          )
          .returning()
        if (nextStartDate.getTime() !== prevStartDate.getTime()) {
          await remapSeriesOverrideStamps(
            tx,
            userId,
            masterRow.id,
            nextStartDate,
            timeZone,
            dayDelta,
          )
        }
        return [row]
      })
      return decryptEvent(updated)
    }

    const plan = planInstanceChange({
      master: masterRow,
      override,
      overrides,
      recurrenceId: parsedId.recurrenceId,
      applyTo,
      fields,
      now: new Date(),
      timeZone,
    })

    if (plan.split) {
      // Split writes + override re-stamps are one atomic unit (plan 003).
      const newMaster = await db.transaction(async (tx) => {
        const created = await applySplitPlan(
          userId,
          masterRow,
          plan,
          tx,
          timeZone,
        )
        if (!created) return null
        await shiftOverrideStamps(
          tx,
          userId,
          plan.split!.moveOverrideIds,
          plan.split!.newSeries.startDate,
          timeZone,
        )
        return created
      })
      return newMaster
    }

    const stored = await db.transaction(async (tx) =>
      applySinglePlan(tx, userId, masterRow, plan),
    )
    if (!stored) return null
    const resolved = resolveInstance(
      masterRow,
      parsedId.recurrenceId,
      [stored, ...overrides] as unknown as EventRow[],
      timeZone,
    )
    if (!resolved) return null
    return { ...resolved, id: eventId, instanceId: eventId }
  }

  const [existing] = await db
    .select()
    .from(calendarEvents)
    .where(
      and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)),
    )
  if (!existing) return null

  if (existing.seriesId !== null) {
    const overrideRow = decryptEvent(existing) as unknown as EventRow
    const merged = mergeOverride<EventRow>(overrideRow, fields)
    const [updated] = await db
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
          eq(calendarEvents.userId, userId),
        ),
      )
      .returning()
    return decryptEvent(updated)
  }

  if (isSeriesEvent({ rrule: existing.rrule })) {
    const seriesRow = decryptEvent(existing) as unknown as EventRow
    const applyTo = data.apply_to ?? 'all'

    if (applyTo === 'all') {
      // Same remap sequence as the instance-'all' branch above. Master-id
      // edits move the anchor itself, and a cross-day move takes the whole
      // pattern with it (mirrors the REST route's master-'all' branch).
      const prevStartDate = seriesRow.startDate
      const nextStartDate =
        (fields.startDate as Date | undefined) ?? prevStartDate
      const allDay = fields.isAllDay ?? seriesRow.isAllDay
      const dayDelta = wallClockDayDelta(prevStartDate, nextStartDate, timeZone)
      let rrule = data.rrule !== undefined ? rawRrule : seriesRow.rrule
      if (
        rrule !== null &&
        dayDelta !== 0 &&
        !canTranslateRuleByDays(rrule, dayDelta)
      ) {
        throw new InvalidEventQueryError(
          "This repeat rule cannot be moved to another day with apply_to 'all'. Change the rrule explicitly, or use 'single' / 'following'.",
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
        ...encryptMergedFields(seriesRow.id, fields),
        ...(rrule !== null ? { rrule } : {}),
        ...(data.exdate !== undefined
          ? { exdate: data.exdate }
          : remappedExdate !== null
            ? { exdate: remappedExdate }
            : {}),
        updatedAt: new Date(),
      }
      const [updated] = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(calendarEvents)
          .set(set)
          .where(
            and(
              eq(calendarEvents.id, seriesRow.id),
              eq(calendarEvents.userId, userId),
            ),
          )
          .returning()
        if (nextStartDate.getTime() !== prevStartDate.getTime()) {
          await remapSeriesOverrideStamps(
            tx,
            userId,
            seriesRow.id,
            nextStartDate,
            timeZone,
            dayDelta,
          )
        }
        return [row]
      })
      return decryptEvent(updated)
    }

    const recurrenceId = resolveMasterEditStamp(seriesRow, timeZone)
    const overrides = (await fetchSeriesOverrides(
      db,
      seriesRow.id,
    )) as unknown as EventRow[]
    const override =
      overrides.find((o) => o.recurrenceId === recurrenceId) ?? null
    const plan = planInstanceChange({
      master: seriesRow,
      override,
      overrides,
      recurrenceId,
      applyTo,
      fields,
      now: new Date(),
      timeZone,
    })

    if (plan.split) {
      // Split writes + override re-stamps are one atomic unit (plan 003).
      const newMaster = await db.transaction(async (tx) => {
        const created = await applySplitPlan(
          userId,
          seriesRow,
          plan,
          tx,
          timeZone,
        )
        if (!created) return null
        await shiftOverrideStamps(
          tx,
          userId,
          plan.split!.moveOverrideIds,
          plan.split!.newSeries.startDate,
          timeZone,
        )
        return created
      })
      return newMaster
    }

    const stored = await db.transaction(async (tx) =>
      applySinglePlan(tx, userId, seriesRow, plan),
    )
    if (!stored) return null
    const resolved = resolveInstance(
      seriesRow,
      recurrenceId,
      [stored, ...overrides] as unknown as EventRow[],
      timeZone,
    )
    if (!resolved) return null
    return { ...resolved, id: eventId, instanceId: eventId }
  }

  const values: Record<string, unknown> = {}
  if (data.title !== undefined)
    values.title = encryptField(eventId, data.title) ?? ''
  if (data.description !== undefined)
    values.description = encryptField(eventId, data.description)
  if (data.location !== undefined)
    values.location = encryptField(eventId, data.location)
  if (data.start_date !== undefined)
    values.startDate = new Date(data.start_date)
  if (data.end_date !== undefined) values.endDate = new Date(data.end_date)
  if (data.is_all_day !== undefined) values.isAllDay = data.is_all_day
  if (data.status !== undefined && data.status !== null)
    values.status = data.status
  if (data.color !== undefined && data.color !== null)
    values.color = normalizeColor(data.color)
  if (data.category_id !== undefined) values.categoryId = data.category_id
  if (data.notification_minutes !== undefined)
    values.notificationMinutes = data.notification_minutes
  if (data.email_reminder !== undefined)
    values.emailReminder = data.email_reminder
  if (data.rrule !== undefined) values.rrule = rawRrule
  if (data.exdate !== undefined) values.exdate = data.exdate
  values.updatedAt = new Date()

  const [event] = await db
    .update(calendarEvents)
    .set(values)
    .where(
      and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)),
    )
    .returning()

  return decryptEvent(event)
}

async function deleteEventImpl(
  userId: string,
  eventId: string,
  applyTo?: ApplyTo,
): Promise<void> {
  const db = await getDb()
  const timeZone = await resolveUserTimeZone(userId)
  const parsedId = isInstanceId(eventId) ? parseInstanceId(eventId) : null

  if (parsedId) {
    const [master] = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.id, parsedId.seriesId),
          eq(calendarEvents.userId, userId),
        ),
      )
    if (!master || !isSeriesEvent({ rrule: master.rrule })) return
    const masterRow = decryptEvent(master) as unknown as EventRow
    const overrides = (await fetchSeriesOverrides(
      db,
      masterRow.id,
    )) as unknown as EventRow[]
    const override =
      overrides.find((o) => o.recurrenceId === parsedId.recurrenceId) ?? null
    const effectiveApplyTo = applyTo ?? 'single'

    if (effectiveApplyTo === 'all') {
      await deleteCalendarEventRow(db, userId, masterRow.id)
      return
    }

    if (effectiveApplyTo === 'single') {
      // Both writes, mirroring the REST route: drop the override row AND
      // exdate the base occurrence — deleting only the override would let
      // the unedited base occurrence resurrect at the next expansion.
      // Atomic (plan 003).
      await db.transaction(async (tx) => {
        if (override) {
          await deleteCalendarEventRow(tx, userId, override.id)
        }
        if (!(masterRow.exdate ?? []).includes(parsedId.recurrenceId)) {
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
                eq(calendarEvents.userId, userId),
              ),
            )
        }
      })
      return
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
    await db.transaction(async (tx) => {
      const newMaster = await applySplitPlan(
        userId,
        masterRow,
        plan,
        tx,
        timeZone,
      )
      if (newMaster) {
        await deleteCalendarEventRow(tx, userId, newMaster.id)
      }
    })
    return
  }

  const [existing] = await db
    .select()
    .from(calendarEvents)
    .where(
      and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)),
    )
  if (!existing) return

  if (existing.seriesId !== null) {
    await deleteCalendarEventRow(db, userId, existing.id)
    return
  }

  if (isSeriesEvent({ rrule: existing.rrule })) {
    const effectiveApplyTo = applyTo ?? 'all'
    if (effectiveApplyTo === 'all') {
      await deleteCalendarEventRow(db, userId, existing.id)
      return
    }
    const seriesRow = decryptEvent(existing) as unknown as EventRow
    const recurrenceId = resolveMasterEditStamp(seriesRow, timeZone)
    const overrides = (await fetchSeriesOverrides(
      db,
      seriesRow.id,
    )) as unknown as EventRow[]
    const override =
      overrides.find((o) => o.recurrenceId === recurrenceId) ?? null
    const plan = planInstanceChange({
      master: seriesRow,
      override,
      overrides,
      recurrenceId,
      applyTo: effectiveApplyTo,
      fields: {},
      now: new Date(),
      timeZone,
    })

    if (plan.split) {
      await db.transaction(async (tx) => {
        const newMaster = await applySplitPlan(
          userId,
          seriesRow,
          plan,
          tx,
          timeZone,
        )
        if (newMaster) {
          await deleteCalendarEventRow(tx, userId, newMaster.id)
        }
      })
      return
    }

    // Mirror the REST route's master-id 'single' delete: remove the override
    // row AND exdate the occurrence, or the engine re-renders the deleted
    // first instance as a ghost. Atomic (plan 003).
    await db.transaction(async (tx) => {
      if (override) {
        await deleteCalendarEventRow(tx, userId, override.id)
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
            eq(calendarEvents.userId, userId),
          ),
        )
    })
    return
  }

  await deleteCalendarEventRow(db, userId, existing.id)
}

/**
 * Snapshot of the rows a mutation may touch, used to drop the right cached
 * month buckets afterwards. Reads the master (or the instance's series) plus
 * its overrides so a split/day-move invalidates both the old and new spans.
 */
async function seriesCacheSpans(
  userId: string,
  eventId: string,
): Promise<Array<{ startDate: Date; endDate: Date; reminderRoot: string }>> {
  try {
    const db = await getDb()
    const parsed = isInstanceId(eventId) ? parseInstanceId(eventId) : null
    const rootId = parsed?.seriesId ?? eventId
    const rows = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          or(
            eq(calendarEvents.id, rootId),
            eq(calendarEvents.seriesId, rootId),
          ),
          eq(calendarEvents.userId, userId),
        ),
      )
    return rows.map((r) => ({
      startDate: new Date(r.startDate),
      endDate: new Date(r.endDate),
      reminderRoot: r.seriesId ?? r.id,
    }))
  } catch {
    return []
  }
}

/**
 * Keeps scheduled reminder emails in step after an MCP mutation, through the
 * same module the REST route uses. There must not be a second scheduling or
 * quota implementation — ADR-0008 makes that argument for participant
 * visibility, and it holds here for the same reason: duplicated rules drift.
 *
 * A quota refusal is surfaced to the agent so it can tell the user why; every
 * other failure is swallowed and left to the top-up cron.
 */
async function reconcileReminders(
  userId: string,
  eventId: string,
  strictQuota: boolean,
): Promise<void> {
  const { reconcileEventReminders, SendQuotaExceeded } =
    await import('@/lib/reminders/reconcile')
  const seriesId = isInstanceId(eventId)
    ? (parseInstanceId(eventId)?.seriesId ?? eventId)
    : eventId
  try {
    await reconcileEventReminders({ userId, eventId: seriesId, strictQuota })
  } catch (error) {
    if (error instanceof SendQuotaExceeded) {
      // ParticipantError is the MCP layer's user-facing 4xx carrier; the tool
      // handlers already translate it into a clean CLI error.
      throw new ParticipantError(error.message, 400)
    }
  }
}

export async function updateEvent(
  ...args: Parameters<typeof updateEventImpl>
): ReturnType<typeof updateEventImpl> {
  const [userId, eventId, data] = args
  const before = await seriesCacheSpans(userId, eventId)
  const result = await updateEventImpl(...args)
  const after = await seriesCacheSpans(userId, eventId)
  await invalidateSeriesCache(userId, [...before, ...after])
  await reconcileReminders(
    userId,
    eventId,
    (data as { email_reminder?: unknown } | undefined)?.email_reminder === true,
  )
  const originalRoot = parseInstanceId(eventId)?.seriesId ?? eventId
  const changedRoots = new Set([
    ...before.map((r) => r.reminderRoot),
    ...(result
      ? [result.seriesId ?? parseInstanceId(result.id)?.seriesId ?? result.id]
      : []),
  ])
  changedRoots.delete(originalRoot)
  for (const root of changedRoots)
    await reconcileReminders(userId, root, data.email_reminder === true)
  return result
}

export async function deleteEvent(
  ...args: Parameters<typeof deleteEventImpl>
): Promise<void> {
  const [userId, eventId] = args
  const before = await seriesCacheSpans(userId, eventId)
  await deleteEventImpl(...args)
  await invalidateSeriesCache(userId, before)
  await reconcileReminders(userId, eventId, false)
  for (const root of new Set(before.map((r) => r.reminderRoot))) {
    if (root !== (parseInstanceId(eventId)?.seriesId ?? eventId))
      await reconcileReminders(userId, root, false)
  }
}
