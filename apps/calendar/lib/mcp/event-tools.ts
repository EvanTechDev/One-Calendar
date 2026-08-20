import { getDb } from '@/lib/drizzle/client'
import {
  calendarEvents,
  calendarCategories,
  eventInvites,
} from '@/lib/drizzle/schema'
import { eq, and, lt, gt, inArray, or, isNotNull, type SQL } from 'drizzle-orm'
import { encryptField } from '@/lib/field-crypto'
import { decryptEvent } from '@/lib/api-helpers'
import { normalizeColor } from './colors'
import { InvalidEventQueryError } from './errors'
import { getSettings } from './settings-tools'
import {
  expandRows,
  firstStampOfSeries,
  mergeOverride,
  planInstanceChange,
  resolveInstance,
  type ApplyTo,
  type EventRow,
  type InstanceChangePlan,
} from '@/lib/event-service'
import {
  adaptRuleToStart,
  isInstanceId,
  isSeriesEvent,
  parseInstanceId,
  parseRfcStamp,
  shiftExdates,
  shiftToAnchorClock,
  withUntil,
} from '@/lib/recurrence/engine'
import { RRule } from 'rrule'
import crypto from 'crypto'

export type EventStatus = 'confirmed' | 'tentative' | 'cancelled'
export const EVENT_STATUSES: EventStatus[] = [
  'confirmed',
  'tentative',
  'cancelled',
]

export type TimePreset =
  | 'today'
  | 'this_week'
  | 'next_week'
  | 'upcoming'
  | 'past'
export type EventSortField =
  | 'start_date'
  | 'end_date'
  | 'created_at'
  | 'updated_at'
export type EventSearchField = 'title' | 'description' | 'location'
export type ParticipantMode = 'any' | 'all'

export const EVENT_FIELD_WHITELIST = [
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
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  series_id: 'seriesId',
  recurrence_id: 'recurrenceId',
}

export interface ListEventsParams {
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
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PALETTE_TO_EVENT_COLOR: Record<string, string> = {
  'bg-blue-500': 'bg-[#E6F6FD]',
  'bg-green-500': 'bg-[#E7F8F2]',
  'bg-yellow-500': 'bg-[#FEF5E6]',
  'bg-amber-500': 'bg-[#FEF5E6]',
  'bg-red-500': 'bg-[#FFE4E6]',
  'bg-purple-500': 'bg-[#F3EEFE]',
  'bg-pink-500': 'bg-[#FCE7F3]',
  'bg-indigo-500': 'bg-[#EEF2FF]',
  'bg-orange-500': 'bg-[#FFF0E5]',
  'bg-teal-500': 'bg-[#E6FAF7]',
}

const EVENT_COLOR_VALUES = new Set([
  'bg-[#E6F6FD]',
  'bg-[#E7F8F2]',
  'bg-[#FEF5E6]',
  'bg-[#FFE4E6]',
  'bg-[#F3EEFE]',
  'bg-[#FCE7F3]',
  'bg-[#EEF2FF]',
  'bg-[#FFF0E5]',
  'bg-[#E6FAF7]',
])

// ---------------------------------------------------------------------------
// Pure helpers (unit-testable)
// ---------------------------------------------------------------------------

export function tzOffsetMs(date: Date, timeZone: string): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    const tzPart =
      dtf.formatToParts(date).find((p) => p.type === 'timeZoneName')?.value ??
      ''
    const match = tzPart.match(/([+-])(\d{2}):(\d{2})/)
    if (!match) return 0
    const sign = match[1] === '-' ? -1 : 1
    return sign * (Number(match[2]) * 60 + Number(match[3])) * 60 * 1000
  } catch {
    return 0
  }
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

function localDateParts(date: Date, timeZone: string) {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    }).formatToParts(date)
  } catch {
    throw new InvalidEventQueryError(`Invalid timezone: ${timeZone}`)
  }
  const map: Record<string, string> = {}
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekday: map.weekday ?? '',
  }
}

function daysFromMonday(date: Date, timeZone: string): number {
  const idx = WEEKDAY_INDEX[localDateParts(date, timeZone).weekday] ?? 0
  return (idx + 6) % 7
}

function localMidnightInTz(date: Date, timeZone: string): Date {
  const { year, month, day } = localDateParts(date, timeZone)
  const candidate = Date.UTC(year, month - 1, day) - tzOffsetMs(date, timeZone)
  return new Date(
    Date.UTC(year, month - 1, day) - tzOffsetMs(new Date(candidate), timeZone),
  )
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

export function normalizeEmails(emails: string[]): string[] {
  const normalized = [...new Set(emails.map((e) => e.trim().toLowerCase()))]
  for (const email of normalized) {
    if (!EMAIL_REGEX.test(email)) {
      throw new InvalidEventQueryError(`Invalid participant email: ${email}`)
    }
  }
  return normalized
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

// ---------------------------------------------------------------------------
// Recurring events helpers
// ---------------------------------------------------------------------------

function isValidRrule(rule: string | null): boolean {
  if (rule === null) return true
  try {
    return typeof RRule.fromString(rule).options.freq === 'number'
  } catch {
    return false
  }
}

function isValidStamp(stamp: string): boolean {
  try {
    parseRfcStamp(stamp)
    return true
  } catch {
    return false
  }
}

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

function encryptMergedFields(
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
  if (fields.startDate !== undefined) encrypted.startDate = fields.startDate
  if (fields.endDate !== undefined) encrypted.endDate = fields.endDate
  if (fields.isAllDay !== undefined) encrypted.isAllDay = fields.isAllDay
  if (fields.status !== undefined) encrypted.status = fields.status
  if (fields.color !== undefined) encrypted.color = fields.color
  if (fields.categoryId !== undefined) encrypted.categoryId = fields.categoryId
  if (fields.notificationMinutes !== undefined)
    encrypted.notificationMinutes = fields.notificationMinutes
  return encrypted
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

async function shiftMovedOverrides(
  db: Db,
  userId: string,
  ids: string[],
  clockSource: Date,
  timeZone?: string,
): Promise<void> {
  if (ids.length === 0) return
  const rows = await db
    .select()
    .from(calendarEvents)
    .where(
      and(inArray(calendarEvents.id, ids), eq(calendarEvents.userId, userId)),
    )
  for (const row of rows) {
    if (!row.recurrenceId) continue
    const newStamp = shiftExdates([row.recurrenceId], clockSource, timeZone)![0]
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

async function applySplitPlan(
  userId: string,
  master: EventRow,
  plan: InstanceChangePlan,
  dbx?: Db,
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

  await db
    .update(calendarEvents)
    .set({
      rrule: withUntil(master.rrule!, split.masterUntil),
      exdate: split.masterExdate,
      updatedAt: new Date(),
    })
    .where(
      and(eq(calendarEvents.id, master.id), eq(calendarEvents.userId, userId)),
    )

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

  const encrypted = encryptMergedFields(upsert.id, upsert.fields)
  let stored
  if (upsert.isNew) {
    ;[stored] = await db
      .insert(calendarEvents)
      .values({
        id: upsert.id,
        userId,
        seriesId: upsert.seriesId,
        recurrenceId: upsert.recurrenceId,
        createdAt: upsert.fields.createdAt as Date,
        updatedAt: upsert.fields.updatedAt as Date,
        ...encrypted,
      } as typeof calendarEvents.$inferInsert)
      .returning()
  } else {
    ;[stored] = await db
      .update(calendarEvents)
      .set({ ...encrypted, updatedAt: new Date() })
      .where(
        and(
          eq(calendarEvents.id, upsert.id),
          eq(calendarEvents.userId, userId),
        ),
      )
      .returning()
  }

  return stored ? decryptEvent(stored) : null
}

// ---------------------------------------------------------------------------
// listEvents
// ---------------------------------------------------------------------------

export async function listEvents(
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

  const settings = await getSettings(userId)
  const defaultTimezone = (settings as Record<string, unknown>).timezone as
    | string
    | undefined

  const { page, limit } = validatePagination(
    params.pagination?.page ?? params.page,
    params.pagination?.limit ?? params.limit,
  )

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

  let events = rows.map(decryptEvent)
  const recurring = recurringRows.map(decryptEvent)
  const recurringIds = new Set(recurring.map((e) => e.id))
  const plainRows = events.filter((e) => !recurringIds.has(e.id))

  if (timeRange.start || timeRange.end) {
    events = expandRows([...plainRows, ...recurring], {
      windowStart: timeRange.start,
      windowEnd: timeRange.end,
    }).map((e) =>
      e.recurrenceId !== null
        ? ({ ...e, id: e.instanceId } as ReturnType<typeof decryptEvent>)
        : (e as ReturnType<typeof decryptEvent>),
    )
  } else {
    events = plainRows
  }

  // Merge invite emails into participants so returned events show the full
  // participant set, not just the ones stored on the event row.
  const emailSets = await buildParticipantEmailSets([
    ...new Set(events.map((e) => (e.seriesId ?? e.id) as string)),
  ])
  for (const event of events) {
    const inviteEmails = emailSets.get((event.seriesId ?? event.id) as string)
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

  if (participantFilter || participantEmails) {
    const normalizedTarget = participantEmails
    events = events.filter((event) => {
      const emails = new Set(extractParticipantEmails(event.participants))
      if (normalizedTarget && normalizedTarget.length > 0) {
        const mode = participantFilter?.mode ?? 'any'
        const matches = matchesParticipantFilter(emails, {
          emails: normalizedTarget,
          mode,
        })
        if (!matches) return false
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
  eventIds: string[],
): Promise<Map<string, Set<string>>> {
  const emailSets = new Map<string, Set<string>>()
  if (eventIds.length === 0) return emailSets
  for (const id of eventIds) emailSets.set(id, new Set())

  const invites = await getDb()
    .select({
      eventId: eventInvites.eventId,
      email: eventInvites.email,
    })
    .from(eventInvites)
    .where(inArray(eventInvites.eventId, eventIds))

  for (const invite of invites) {
    emailSets.get(invite.eventId)?.add(invite.email.toLowerCase())
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

  return decryptEvent(event)
}

export async function updateEvent(
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
    rrule?: string | null
    exdate?: string[] | null
    apply_to?: ApplyTo
  },
) {
  const db = await getDb()
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

    if (applyTo === 'all') {
      // Mirror the REST route's instance-'all' sequence: clamp the new start
      // to the master's anchor day (only the clock moves), adapt the rule,
      // clock-remap stored exdates, then re-stamp overrides — otherwise an
      // MCP "all events" time change orphans every single-instance override
      // and resurrects exdated occurrences. No timeZone is threaded through
      // MCP (deferred finding); helpers fall back to server-local day parts.
      const prevStartDate = masterRow.startDate
      const nextStartDate =
        (fields.startDate as Date | undefined) ?? prevStartDate
      const allDay = fields.isAllDay ?? masterRow.isAllDay
      const anchorStart = shiftToAnchorClock(prevStartDate, nextStartDate)
      if (fields.startDate !== undefined) {
        fields.startDate = anchorStart
        if (fields.endDate !== undefined && fields.endDate !== null) {
          const delta = nextStartDate.getTime() - anchorStart.getTime()
          fields.endDate = new Date((fields.endDate as Date).getTime() - delta)
        }
      }
      let rrule = data.rrule !== undefined ? rawRrule : masterRow.rrule
      if (rrule !== null) {
        rrule = adaptRuleToStart(rrule, prevStartDate, anchorStart, allDay)
      }
      const remappedExdate = shiftExdates(masterRow.exdate, nextStartDate)
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
      const [updated] = await db
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
        const seriesOverrides = await fetchSeriesOverrides(db, masterRow.id)
        await shiftMovedOverrides(
          db,
          userId,
          seriesOverrides.map((o) => o.id),
          nextStartDate,
        )
      }
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
    })

    if (plan.split) {
      // Split writes + override re-stamps are one atomic unit (plan 003).
      const newMaster = await db.transaction(async (tx) => {
        const created = await applySplitPlan(userId, masterRow, plan, tx)
        if (!created) return null
        await shiftMovedOverrides(
          tx,
          userId,
          plan.split!.moveOverrideIds,
          plan.split!.newSeries.startDate,
        )
        return created
      })
      return newMaster
    }

    const stored = await db.transaction(async (tx) =>
      applySinglePlan(tx, userId, masterRow, plan),
    )
    if (!stored) return null
    const resolved = resolveInstance(masterRow, parsedId.recurrenceId, [
      stored,
      ...overrides,
    ] as unknown as EventRow[])
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
      // Same remap sequence as the instance-'all' branch above: adapt the
      // rule to the new start, clock-remap exdates, re-stamp overrides.
      // Master-id edits move the anchor itself, so no anchor-day clamp
      // (mirrors the REST route's master-'all' branch).
      const prevStartDate = seriesRow.startDate
      const nextStartDate =
        (fields.startDate as Date | undefined) ?? prevStartDate
      const allDay = fields.isAllDay ?? seriesRow.isAllDay
      let rrule = data.rrule !== undefined ? rawRrule : seriesRow.rrule
      if (rrule !== null) {
        rrule = adaptRuleToStart(rrule, prevStartDate, nextStartDate, allDay)
      }
      const remappedExdate = shiftExdates(seriesRow.exdate, nextStartDate)
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
      const [updated] = await db
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
        const seriesOverrides = await fetchSeriesOverrides(db, seriesRow.id)
        await shiftMovedOverrides(
          db,
          userId,
          seriesOverrides.map((o) => o.id),
          nextStartDate,
        )
      }
      return decryptEvent(updated)
    }

    const recurrenceId = firstStampOfSeries(seriesRow)
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
    })

    if (plan.split) {
      // Split writes + override re-stamps are one atomic unit (plan 003).
      const newMaster = await db.transaction(async (tx) => {
        const created = await applySplitPlan(userId, seriesRow, plan, tx)
        if (!created) return null
        await shiftMovedOverrides(
          tx,
          userId,
          plan.split!.moveOverrideIds,
          plan.split!.newSeries.startDate,
        )
        return created
      })
      return newMaster
    }

    const stored = await db.transaction(async (tx) =>
      applySinglePlan(tx, userId, seriesRow, plan),
    )
    if (!stored) return null
    const resolved = resolveInstance(seriesRow, recurrenceId, [
      stored,
      ...overrides,
    ] as unknown as EventRow[])
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

export async function deleteEvent(
  userId: string,
  eventId: string,
  applyTo?: ApplyTo,
): Promise<void> {
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
    })
    await db.transaction(async (tx) => {
      const newMaster = await applySplitPlan(userId, masterRow, plan, tx)
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
    const recurrenceId = firstStampOfSeries(seriesRow)
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
    })

    if (plan.split) {
      await db.transaction(async (tx) => {
        const newMaster = await applySplitPlan(userId, seriesRow, plan, tx)
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
