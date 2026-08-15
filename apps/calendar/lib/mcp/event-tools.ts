import { getDb } from '@/lib/drizzle/client'
import {
  calendarEvents,
  calendarCategories,
  eventInvites,
} from '@/lib/drizzle/schema'
import { eq, and, lt, gt, inArray, type SQL } from 'drizzle-orm'
import { encryptField } from '@/lib/field-crypto'
import { decryptEvent } from '@/lib/api-helpers'
import { normalizeColor } from './colors'
import { InvalidEventQueryError } from './errors'
import { getSettings } from './settings-tools'
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
] as const

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
  const allowed = new Set(EVENT_FIELD_WHITELIST)
  for (const field of fields) {
    if (!allowed.has(field as (typeof EVENT_FIELD_WHITELIST)[number])) {
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
  const wanted = new Set<string>(fields)
  wanted.add('id')
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(event)) {
    if (wanted.has(key)) result[key] = value
  }
  return result
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

  let events = rows.map(decryptEvent)

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
    const emailSets = await buildParticipantEmailSets(events.map((e) => e.id))
    const normalizedTarget = participantEmails
    events = events.filter((event) => {
      const emails = emailSets.get(event.id) ?? new Set<string>()
      for (const email of extractParticipantEmails(event.participants)) {
        emails.add(email)
      }
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
  const [row] = await db
    .select()
    .from(calendarEvents)
    .where(
      and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)),
    )

  if (!row) return null
  return decryptEvent(row)
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
  },
) {
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
  },
) {
  const db = await getDb()
  const existing = await getEvent(userId, eventId)
  if (!existing) return null

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
): Promise<void> {
  const db = await getDb()
  await db
    .delete(calendarEvents)
    .where(
      and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)),
    )
}
