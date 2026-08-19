import { RRule } from 'rrule'
import type { Frequency, Options, Weekday } from 'rrule'
import { translations } from '@zntr/i18n/calendar'

export const MAX_EXPANSION = 1000

export const DEFAULT_EXPANSION_WINDOW_MS = 2 * 365 * 24 * 60 * 60 * 1000

export const defaultExpansionWindow = () => {
  const now = Date.now()
  return {
    windowStart: new Date(now - DEFAULT_EXPANSION_WINDOW_MS),
    windowEnd: new Date(now + DEFAULT_EXPANSION_WINDOW_MS),
  }
}

export interface RecurrenceEvent {
  id: string
  startDate: Date | string
  endDate: Date | string
  isAllDay: boolean
  rrule: string | null
  exdate: string[] | null
}

export interface RecurrenceInstance {
  id: string
  seriesId: string
  recurrenceId: string
  startDate: Date
  endDate: Date
  isAllDay: boolean
}

export interface RruleParts {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  interval: number
  byweekday: string[] | null
  bymonthday: number[] | null
  bysetpos: number | null
  bymonth: number[] | null
  until: string | null
  count: number | null
}

const DAY_NAMES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const
const DAY_INDEX: Record<string, number> = {
  MO: 0,
  TU: 1,
  WE: 2,
  TH: 3,
  FR: 4,
  SA: 5,
  SU: 6,
}
const WEEKDAYS: Weekday[] = [
  RRule.MO,
  RRule.TU,
  RRule.WE,
  RRule.TH,
  RRule.FR,
  RRule.SA,
  RRule.SU,
]
const FREQ_NAMES = ['YEARLY', 'MONTHLY', 'WEEKLY', 'DAILY']
const FREQ_NUMBERS: Record<string, Frequency> = {
  YEARLY: RRule.YEARLY,
  MONTHLY: RRule.MONTHLY,
  WEEKLY: RRule.WEEKLY,
  DAILY: RRule.DAILY,
}
const DATE_RE = /^(\d{4})(\d{2})(\d{2})$/
const DATETIME_RE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

interface DateParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const tzFormatterCache = new Map<string, Intl.DateTimeFormat>()

function getTzFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = tzFormatterCache.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    tzFormatterCache.set(timeZone, formatter)
  }
  return formatter
}

export function partsInTz(date: Date, timeZone: string): DateParts {
  const parts = getTzFormatter(timeZone).formatToParts(date)
  const value = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0')
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  }
}

export function partsInLocal(date: Date): DateParts {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
  }
}

function partsOfUtcDay(date: Date): DateParts {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: 0,
    minute: 0,
    second: 0,
  }
}

function tzOffsetMs(timeZone: string, utcMs: number): number {
  const p = partsInTz(new Date(utcMs), timeZone)
  return (
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - utcMs
  )
}

export function wallClockToInstant(
  parts: DateParts,
  clock: { hour: number; minute: number; second: number },
  timeZone?: string,
): Date {
  if (timeZone) {
    const naive = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      clock.hour,
      clock.minute,
      clock.second,
    )
    return new Date(naive - tzOffsetMs(timeZone, naive))
  }
  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    clock.hour,
    clock.minute,
    clock.second,
  )
}

function dayStamp(parts: DateParts): string {
  return `${parts.year}${pad(parts.month)}${pad(parts.day)}`
}

export function mergeOverride<T extends object>(
  master: T,
  override: Partial<Record<keyof T, unknown>> | null | undefined,
): T {
  if (override === null || override === undefined) {
    return master
  }
  const merged = { ...master } as Record<string, unknown>
  for (const [key, value] of Object.entries(override)) {
    if (value !== null && value !== undefined) {
      merged[key] = value
    }
  }
  return merged as T
}

export function toRfcStamp(date: Date, isAllDay: boolean): string {
  if (isAllDay) {
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  }
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
}

function invalidStamp(stamp: string): never {
  throw new Error(`Invalid RFC stamp: ${stamp}`)
}

function buildUtcDate(
  stamp: string,
  match: RegExpExecArray,
  withTime: boolean,
): Date {
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = withTime ? Number(match[4]) : 0
  const minute = withTime ? Number(match[5]) : 0
  const second = withTime ? Number(match[6]) : 0
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  const exact =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
  if (!exact) {
    return invalidStamp(stamp)
  }
  return date
}

export function parseRfcStamp(stamp: string): {
  date: Date
  isAllDay: boolean
} {
  const dateMatch = DATE_RE.exec(stamp)
  if (dateMatch) {
    return { date: buildUtcDate(stamp, dateMatch, false), isAllDay: true }
  }
  const datetimeMatch = DATETIME_RE.exec(stamp)
  if (datetimeMatch) {
    if (
      Number(datetimeMatch[4]) > 23 ||
      Number(datetimeMatch[5]) > 59 ||
      Number(datetimeMatch[6]) > 59
    ) {
      return invalidStamp(stamp)
    }
    return { date: buildUtcDate(stamp, datetimeMatch, true), isAllDay: false }
  }
  return invalidStamp(stamp)
}

function isRfcStamp(stamp: string): boolean {
  try {
    parseRfcStamp(stamp)
    return true
  } catch {
    return false
  }
}

export function buildInstanceId(
  seriesId: string,
  recurrenceId: string,
): string {
  return `${seriesId}_${recurrenceId}`
}

export function parseInstanceId(
  instanceId: string,
): { seriesId: string; recurrenceId: string } | null {
  const separator = instanceId.lastIndexOf('_')
  if (separator <= 0) {
    return null
  }
  const seriesId = instanceId.slice(0, separator)
  const recurrenceId = instanceId.slice(separator + 1)
  if (!isRfcStamp(recurrenceId)) {
    return null
  }
  return { seriesId, recurrenceId }
}

export function isInstanceId(id: string): boolean {
  return parseInstanceId(id) !== null
}

export function isSeriesEvent(event: { rrule: string | null }): boolean {
  return typeof event.rrule === 'string' && event.rrule.trim().length > 0
}

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

export function expandSeries(
  series: RecurrenceEvent,
  windowStart: Date,
  windowEnd: Date,
  max = MAX_EXPANSION,
  timeZone?: string,
): RecurrenceInstance[] {
  const rruleString = series.rrule
  if (rruleString === null || rruleString.trim().length === 0) {
    return []
  }
  const windowFrom = windowStart.getTime()
  const windowTo = windowEnd.getTime()
  if (windowFrom > windowTo) {
    return []
  }
  const isAllDay = series.isAllDay
  const start = toDate(series.startDate)
  const duration = toDate(series.endDate).getTime() - start.getTime()
  const anchorParts = timeZone
    ? partsInTz(start, timeZone)
    : partsInLocal(start)
  const clock = {
    hour: isAllDay ? 0 : anchorParts.hour,
    minute: isAllDay ? 0 : anchorParts.minute,
    second: isAllDay ? 0 : anchorParts.second,
  }
  const ruleDtstart = new Date(
    Date.UTC(anchorParts.year, anchorParts.month - 1, anchorParts.day),
  )
  const toDayParts = (date: Date): DateParts =>
    timeZone ? partsInTz(date, timeZone) : partsOfUtcDay(date)
  const toOccurrence = (date: Date): Date =>
    wallClockToInstant(toDayParts(date), clock, timeZone)

  let occurrences: Date[] = []
  try {
    const parsed = RRule.fromString(rruleString.trim())
    const rule = new RRule({ ...parsed.origOptions, dtstart: ruleDtstart })
    occurrences = rule.between(windowStart, windowEnd, true)
  } catch {
    occurrences = []
  }

  const included = new Set(occurrences.map((date) => date.getTime()))
  const anchorTime = ruleDtstart.getTime()
  if (
    anchorTime >= windowFrom &&
    anchorTime <= windowTo &&
    !included.has(anchorTime)
  ) {
    occurrences.unshift(ruleDtstart)
  }

  const exdateStamps = new Set(series.exdate ?? [])
  occurrences = occurrences.filter(
    (date) =>
      !exdateStamps.has(
        isAllDay
          ? dayStamp(toDayParts(date))
          : toRfcStamp(toOccurrence(date), false),
      ),
  )

  if (max > 0 && occurrences.length > max) {
    occurrences = occurrences.slice(0, max)
  }

  return occurrences.map((date) => {
    const dayParts = toDayParts(date)
    const startDate = toOccurrence(date)
    const recurrenceId = isAllDay
      ? dayStamp(dayParts)
      : toRfcStamp(startDate, false)
    return {
      id: buildInstanceId(series.id, recurrenceId),
      seriesId: series.id,
      recurrenceId,
      startDate,
      endDate: new Date(startDate.getTime() + duration),
      isAllDay,
    }
  })
}

function toRruleLine(rule: RRule): string {
  return rule
    .toString()
    .split('\n')
    .filter((line) => line.length > 0 && !line.startsWith('DTSTART:'))
    .map((line) => line.replace(/^RRULE:/, ''))
    .join('\n')
}

export interface SeriesViewInput extends RecurrenceEvent {
  seriesId: string | null
  recurrenceId?: string | null
  [key: string]: unknown
}

/**
 * Expands a set of master + override rows into the same instance shape the
 * server returns from GET /api/events. Pure and dependency-free so it can run
 * on the client to render a series' occurrences instantly after a mutation.
 *
 * - Masters with an rrule are expanded; each instance is merged with its
 *   override (matched by recurrenceId) and its `id` is set to the instance id.
 * - Non-recurring rows pass through with `id` kept and `recurrenceId: null`.
 * - Rows whose master is absent are emitted as plain pass-through rows.
 */
export function expandSeriesView<T extends SeriesViewInput>(
  rows: T[],
  overrides: T[] = [],
  windowStart: Date,
  windowEnd: Date,
  max = MAX_EXPANSION,
  timeZone?: string,
): T[] {
  const overridesBySeries: Record<string, T[]> = {}
  for (const row of overrides) {
    if (row.seriesId === null || row.seriesId === undefined) continue
    const list = overridesBySeries[row.seriesId] ?? []
    list.push(row)
    overridesBySeries[row.seriesId] = list
  }

  const masters = rows.filter((row) => row.seriesId === null)
  const masterIds = new Set(masters.map((row) => row.id))
  const orphans = rows.filter((row) => row.seriesId !== null)

  const result: T[] = []
  for (const master of masters) {
    if (master.rrule !== null && master.rrule.trim().length > 0) {
      const instances = expandSeries(
        master,
        windowStart,
        windowEnd,
        max,
        timeZone,
      )
      const seriesOverrides = overridesBySeries[master.id] ?? []
      const matchedRecurrenceIds = new Set<string>()
      for (const instance of instances) {
        const override =
          seriesOverrides.find(
            (o) => o.recurrenceId === instance.recurrenceId,
          ) ?? null
        matchedRecurrenceIds.add(instance.recurrenceId)
        const base = {
          ...master,
          startDate: instance.startDate,
          endDate: instance.endDate,
          seriesId: master.id,
          recurrenceId: instance.recurrenceId,
        } as T
        const merged = override ? mergeOverride(base, override) : base
        result.push({
          ...merged,
          id: instance.id,
          instanceId: instance.id,
          ...(override ? { isOverride: true } : {}),
        } as T)
      }
      for (const override of seriesOverrides) {
        const overrideRecurrenceId = override.recurrenceId
        if (
          typeof overrideRecurrenceId !== 'string' ||
          matchedRecurrenceIds.has(overrideRecurrenceId)
        ) {
          continue
        }
        const instanceId = buildInstanceId(master.id, overrideRecurrenceId)
        result.push({
          ...master,
          ...override,
          rrule: master.rrule,
          seriesId: master.id,
          id: instanceId,
          instanceId,
          isOverride: true,
        } as T)
      }
    } else {
      result.push({
        ...master,
        id: master.id,
        instanceId: master.id,
        recurrenceId: null,
      } as T)
    }
  }

  for (const orphan of orphans) {
    if (masterIds.has(orphan.seriesId!)) continue
    result.push({
      ...orphan,
      seriesId: null,
      id: orphan.id,
      instanceId: orphan.id,
    } as T)
  }
  return result
}

/**
 * Optimistically applies a "this and following" series edit on the client:
 * instances before the target stay untouched, the edited event becomes the
 * new series master, and the rule regenerates every instance from the
 * target onward so the recurrence renders instantly. Single-edited
 * overrides from the old series are remapped to the new series' clock
 * space (matching remapOverridesClock / optimisticSeries behaviour) AND
 * re-parented onto the new master — expandSeriesView groups overrides by
 * seriesId, so keeping the old seriesId here would silently drop them
 * until the server response lands.
 */
export function optimisticFollowingSplit<T>(
  current: T[],
  target: T,
  nextMaster: T,
  windowStart: Date,
  windowEnd: Date,
  max = MAX_EXPANSION,
  timeZone?: string,
): T[] | null {
  const targetRow = target as unknown as SeriesViewInput
  const master = nextMaster as unknown as SeriesViewInput
  const targetSeriesId = targetRow.seriesId
  const recurrenceId = targetRow.recurrenceId
  if (
    !targetSeriesId ||
    !recurrenceId ||
    !isSeriesEvent(master) ||
    typeof master.id !== 'string'
  ) {
    return null
  }
  const kept = current.filter(
    (e) =>
      (e as SeriesViewInput).seriesId !== targetSeriesId ||
      ((e as SeriesViewInput).recurrenceId ?? '') < recurrenceId,
  )
  const clockSource = new Date(master.startDate)
  const overrides = current
    .filter(
      (e) =>
        (e as SeriesViewInput).seriesId === targetSeriesId &&
        (e as SeriesViewInput).isOverride &&
        ((e as SeriesViewInput).recurrenceId ?? '') >= recurrenceId,
    )
    .map((e) => ({
      ...e,
      seriesId: master.id,
      recurrenceId: shiftExdates(
        [(e as SeriesViewInput).recurrenceId!],
        clockSource,
      )![0],
    })) as unknown as SeriesViewInput[]
  const expanded = expandSeriesView(
    [master],
    overrides,
    windowStart,
    windowEnd,
    max,
    timeZone,
  ) as unknown as T[]
  return [...kept, ...expanded]
}

export function withUntil(rruleString: string, untilStamp: string): string {
  const parsed = RRule.fromString(rruleString)
  const parts = { ...parsed.origOptions, until: parseRfcStamp(untilStamp).date }
  delete parts.count
  return toRruleLine(new RRule(parts))
}

export function reanchor(
  rule: string,
  newStartDate: Date,
  newStartIsAllDay: boolean,
  remainingCount?: number | null,
): string {
  const parsed = RRule.fromString(rule)
  const dtstart = newStartIsAllDay ? utcMidnight(newStartDate) : newStartDate
  // UNTIL is an absolute bound: the re-anchored series must honour the same
  // end instead of silently becoming infinite. COUNT is re-based by the
  // caller to the occurrences still remaining after the split point.
  const parts = {
    ...parsed.origOptions,
    dtstart,
    until: parsed.origOptions.until ?? null,
    count: remainingCount ?? null,
  }
  return toRruleLine(new RRule(parts))
}

/**
 * How many occurrences a COUNT-bound series still has to produce from the
 * split instant onward — the original COUNT minus the occurrences generated
 * strictly before it. Returns null when the rule has no COUNT (or cannot be
 * parsed), letting callers fall back to an unbounded rule. The day-based
 * counting mirrors expandSeries so the remaining length matches what the
 * old series actually rendered.
 */
export function remainingSeriesCount(
  rruleString: string,
  seriesStart: Date,
  splitInstant: Date,
  timeZone?: string,
): number | null {
  try {
    const parsed = RRule.fromString(rruleString.trim())
    const count = parsed.origOptions.count
    if (typeof count !== 'number') return null
    const anchorParts = timeZone
      ? partsInTz(seriesStart, timeZone)
      : partsInLocal(seriesStart)
    const ruleDtstart = new Date(
      Date.UTC(anchorParts.year, anchorParts.month - 1, anchorParts.day),
    )
    const rule = new RRule({ ...parsed.origOptions, dtstart: ruleDtstart })
    const splitParts = timeZone
      ? partsInTz(splitInstant, timeZone)
      : partsInLocal(splitInstant)
    const splitDay = new Date(
      Date.UTC(splitParts.year, splitParts.month - 1, splitParts.day),
    )
    const beforeSplit = rule.between(new Date(0), splitDay, false).length
    return Math.max(count - beforeSplit, 1)
  } catch {
    return null
  }
}

export function isValidRrule(rule: string): boolean {
  if (typeof rule !== 'string' || rule.trim().length === 0) {
    return false
  }
  try {
    const options = RRule.fromString(rule).origOptions
    return options.freq !== null && options.freq !== undefined
  } catch {
    return false
  }
}

function dayOfWeek(parts: DateParts): number {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()
}

function partsOfDate(date: Date, timeZone?: string): DateParts {
  return timeZone ? partsInTz(date, timeZone) : partsInLocal(date)
}

function weekdayNameOf(date: Date, timeZone?: string): string {
  return DAY_NAMES[
    ((dayOfWeek(partsOfDate(date, timeZone)) + 6) % 7) as
      | 0
      | 1
      | 2
      | 3
      | 4
      | 5
      | 6
  ]
}

function firstDayIndex(parts: DateParts): number {
  return new Date(Date.UTC(parts.year, parts.month - 1, 1)).getUTCDay()
}

function monthHasWeekdayAt(
  date: Date,
  weekdayName: string,
  timeZone?: string,
): number {
  const parts = partsOfDate(date, timeZone)
  const daysInMonth = new Date(parts.year, parts.month, 0).getDate()
  const index = DAY_INDEX[weekdayName]
  let count = 0
  for (let day = 1; day <= daysInMonth; day++) {
    if (
      new Date(Date.UTC(parts.year, parts.month - 1, day)).getUTCDay() === index
    ) {
      count++
    }
  }
  return count
}

function matchesParts(
  parts: RruleParts,
  date: Date,
  timeZone?: string,
): boolean {
  const partsOf = partsOfDate(date, timeZone)
  if (parts.freq === 'WEEKLY') {
    if (!parts.byweekday || parts.byweekday.length === 0) return true
    return parts.byweekday.includes(weekdayNameOf(date, timeZone))
  }
  if (parts.freq === 'MONTHLY') {
    if (
      parts.byweekday &&
      parts.byweekday.length > 0 &&
      parts.bysetpos !== null
    ) {
      if (weekdayNameOf(date, timeZone) !== parts.byweekday[0]) return false
      const total = monthHasWeekdayAt(date, parts.byweekday[0], timeZone)
      const weekdayId = DAY_INDEX[parts.byweekday[0]]
      const firstDayIdx = (firstDayIndex(partsOf) + 6) % 7
      const firstOccurrence = 1 + ((weekdayId - firstDayIdx + 7) % 7)
      const day = partsOf.day
      if (day < firstOccurrence) return false
      const nth = Math.floor((day - firstOccurrence) / 7) + 1
      const fromLast = total - nth + 1
      return parts.bysetpos === nth || -parts.bysetpos === fromLast
    }
    if (parts.bymonthday && parts.bymonthday.length > 0) {
      return parts.bymonthday.includes(partsOf.day)
    }
    return true
  }
  if (parts.freq === 'YEARLY') {
    if (parts.bymonth && parts.bymonth.length > 0) {
      if (!parts.bymonth.includes(partsOf.month)) return false
    }
    if (parts.bymonthday && parts.bymonthday.length > 0) {
      if (!parts.bymonthday.includes(partsOf.day)) return false
    }
    return true
  }
  return true
}

/**
 * Returns `anchorDate`'s date components combined with `clockSource`'s
 * time-of-day. Used to apply a time-only change to a series without moving
 * its anchor day (an "all events" edit from a mid-series occurrence must
 * keep every occurrence on its existing date).
 */
export function shiftToAnchorClock(
  anchorDate: Date,
  clockSource: Date,
  timeZone?: string,
): Date {
  const source = timeZone
    ? partsInTz(clockSource, timeZone)
    : partsInLocal(clockSource)
  const anchor = timeZone
    ? partsInTz(anchorDate, timeZone)
    : partsInLocal(anchorDate)
  const clock = {
    hour: source.hour,
    minute: source.minute,
    second: source.second,
  }
  return wallClockToInstant(
    {
      year: anchor.year,
      month: anchor.month,
      day: anchor.day,
      hour: clock.hour,
      minute: clock.minute,
      second: clock.second,
    },
    clock,
    timeZone,
  )
}

/**
 * Re-stamps a series' exdates with the new clock time. Occurrences are
 * identified by their recurrence stamp, so after a time-of-day change on
 * the whole series the stored exdate stamps no longer match the shifted
 * occurrences and the deleted instances would silently resurrect.
 */
export function shiftExdates(
  exdates: string[] | null | undefined,
  clockSource: Date,
  timeZone?: string,
): string[] | null {
  if (!exdates || exdates.length === 0) return null
  return exdates.map((stamp) => {
    const parsed = parseRfcStamp(stamp)
    return toRfcStamp(
      shiftToAnchorClock(parsed.date, clockSource, timeZone),
      parsed.isAllDay,
    )
  })
}

/**
 * Re-stamps a recurrence stamp by a full millisecond delta. Used when a
 * series is split at an instance ("this and following"): the moved overrides
 * and the new series' exdates must shift by the same delta as the new anchor,
 * otherwise their stamps no longer match the regenerated occurrences and
 * single-instance edits would resurface as orphan duplicates.
 */
export function shiftStamp(stamp: string, deltaMs: number): string {
  const parsed = parseRfcStamp(stamp)
  return toRfcStamp(new Date(parsed.date.getTime() + deltaMs), parsed.isAllDay)
}

/**
 * Re-anchors an RRULE so that `newStartDate` is a member of the recurrence set.
 *
 * Fixes the "root event disappears after a save" case: when a series master's
 * start date is moved to a day that no longer satisfies the rule (e.g. a
 * Monday rule moved to Tuesday, or an until date moved past), the rule is
 * rewritten to match the new anchor and, when needed, the series end is
 * shifted by the same delta as the start.
 */
export function adaptRuleToStart(
  rule: string,
  previousStartDate: Date,
  newStartDate: Date,
  isAllDay: boolean,
  timeZone?: string,
): string {
  let parts: RruleParts
  try {
    parts = rruleToParts(rule)
  } catch {
    return rule
  }
  const anchor = newStartDate
  if (!matchesParts(parts, anchor, timeZone)) {
    const anchorParts = partsOfDate(anchor, timeZone)
    const day = anchorParts.day
    if (parts.freq === 'WEEKLY') {
      parts = { ...parts, byweekday: [weekdayNameOf(anchor, timeZone)] }
    } else if (parts.freq === 'MONTHLY') {
      parts = {
        ...parts,
        byweekday: null,
        bysetpos: null,
        bymonthday: [day],
      }
    } else if (parts.freq === 'YEARLY') {
      parts = {
        ...parts,
        bymonth: [anchorParts.month],
        bymonthday: [day],
      }
    }
  }
  if (parts.until !== null) {
    let untilDate: Date
    try {
      untilDate = parseRfcStamp(parts.until).date
    } catch {
      untilDate = new Date(NaN)
    }
    if (
      !Number.isNaN(untilDate.getTime()) &&
      untilDate.getTime() < anchor.getTime()
    ) {
      const delta = anchor.getTime() - previousStartDate.getTime()
      parts = {
        ...parts,
        until: toRfcStamp(new Date(untilDate.getTime() + delta), isAllDay),
      }
    }
  }
  try {
    return rruleFromParts(parts)
  } catch {
    return rule
  }
}

export function rruleFromParts(parts: RruleParts): string {
  if (!Number.isInteger(parts.interval) || parts.interval < 1) {
    throw new Error('interval must be a positive integer')
  }
  if (parts.until !== null && parts.count !== null) {
    throw new Error('until and count cannot both be set')
  }
  const options: Partial<Options> = {
    freq: FREQ_NUMBERS[parts.freq],
    interval: parts.interval,
    count: parts.count,
    until: parts.until !== null ? parseRfcStamp(parts.until).date : null,
    byweekday: parts.byweekday !== null ? parts.byweekday.map(toWeekday) : null,
    bymonthday: parts.bymonthday ?? null,
    bysetpos: parts.bysetpos !== null ? [parts.bysetpos] : null,
    bymonth: parts.bymonth ?? null,
  }
  return toRruleLine(new RRule(options))
}

export function rruleToParts(rule: string): RruleParts {
  const options = RRule.fromString(rule).origOptions
  const freqName =
    options.freq !== null && options.freq !== undefined
      ? FREQ_NAMES[options.freq]
      : undefined
  if (!freqName) {
    throw new Error('Invalid rule: missing FREQ')
  }
  return {
    freq: freqName as RruleParts['freq'],
    interval: options.interval ?? 1,
    byweekday: toDayNames(
      options.byweekday as
        | string
        | { weekday: number }
        | (string | { weekday: number })[]
        | null
        | undefined,
    ),
    bymonthday: toArrayOrNull(options.bymonthday),
    bysetpos: toSingleOrNull(options.bysetpos),
    bymonth: toArrayOrNull(options.bymonth),
    until:
      options.until !== null && options.until !== undefined
        ? toUntilStamp(options.until)
        : null,
    count: options.count ?? null,
  }
}

function toWeekday(name: string): Weekday {
  const index = DAY_INDEX[name.toUpperCase()]
  if (index === undefined) {
    throw new Error(`Invalid weekday: ${name}`)
  }
  return WEEKDAYS[index]
}

function toDayNames(
  value:
    | string
    | { weekday: number }
    | (string | { weekday: number })[]
    | null
    | undefined,
): string[] | null {
  if (value === null || value === undefined) {
    return null
  }
  const list = Array.isArray(value) ? value : [value]
  return list.map((entry) =>
    typeof entry === 'string' ? entry.toUpperCase() : DAY_NAMES[entry.weekday],
  )
}

function toArrayOrNull(
  value: number | number[] | null | undefined,
): number[] | null {
  if (value === null || value === undefined) {
    return null
  }
  return Array.isArray(value) ? value.slice() : [value]
}

function toSingleOrNull(
  value: number | number[] | null | undefined,
): number | null {
  if (value === null || value === undefined) {
    return null
  }
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function toUntilStamp(date: Date): string {
  const atMidnight =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  return toRfcStamp(date, atMidnight)
}

const ZH_WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const ZH_WEEKDAY_SHORT = ['一', '二', '三', '四', '五', '六', '日']
const EN_WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]
const EN_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function ordinal(n: number): string {
  const suffix =
    n % 10 === 1 && n % 100 !== 11
      ? 'st'
      : n % 10 === 2 && n % 100 !== 12
        ? 'nd'
        : n % 10 === 3 && n % 100 !== 13
          ? 'rd'
          : 'th'
  return `${n}${suffix}`
}

export function describeRecurrence(rule: string, isZh: boolean): string {
  let parts: RruleParts
  try {
    parts = rruleToParts(rule)
  } catch {
    return rule
  }
  const t = translations[isZh ? 'zh-CN' : 'en']
  const {
    freq,
    interval,
    byweekday,
    bymonthday,
    bysetpos,
    bymonth,
    until,
    count,
  } = parts
  const i = Math.max(1, interval)
  const everyDays = t.recurrenceEveryDays.replace('{n}', String(i))
  const everyWeeks = t.recurrenceEveryWeeks.replace('{n}', String(i))
  const everyMonths = t.recurrenceEveryMonths.replace('{n}', String(i))
  const everyYears = t.recurrenceEveryYears.replace('{n}', String(i))
  let label: string
  if (freq === 'DAILY') {
    label = i > 1 ? everyDays : t.repeatFrequencyDaily
  } else if (freq === 'WEEKLY') {
    label = i > 1 ? everyWeeks : t.repeatFrequencyWeekly
    if (byweekday !== null && byweekday.length > 0) {
      const days = byweekday
        .slice()
        .sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b])
        .map((d) =>
          isZh ? ZH_WEEKDAYS[DAY_INDEX[d]] : EN_WEEKDAYS[DAY_INDEX[d]],
        )
        .join(isZh ? '、' : ', ')
      label += ` · ${days}`
    }
  } else if (freq === 'MONTHLY') {
    label = i > 1 ? everyMonths : t.repeatFrequencyMonthly
    if (bysetpos !== null && byweekday !== null && byweekday.length > 0) {
      const ord =
        bysetpos === -1
          ? t.recurrenceLastWeek
          : t.recurrenceNthWeek.replace('{n}', String(bysetpos))
      const day = isZh
        ? ZH_WEEKDAY_SHORT[DAY_INDEX[byweekday[0].toUpperCase()]]
        : EN_WEEKDAYS[DAY_INDEX[byweekday[0].toUpperCase()]]
      label += isZh ? ` · ${ord}周${day}` : ` · ${ord} ${day}`
    } else if (bymonthday !== null && bymonthday.length > 0) {
      const d = bymonthday[0]
      label +=
        d < 0
          ? ` · ${t.recurrenceLastDay}`
          : isZh
            ? ` · ${d} 日`
            : ` · ${ordinal(d)}`
    }
  } else {
    label = i > 1 ? everyYears : t.repeatFrequencyYearly
    if (bymonth !== null && bymonth.length > 0) {
      const month = bymonth[0]
      const day = bymonthday?.[0] ?? 1
      label += isZh
        ? ` · ${month} 月 ${day} 日`
        : ` · ${EN_MONTHS[month - 1]} ${day}`
    }
  }
  if (until !== null) {
    label += ` · ${t.recurrenceUntilSuffix.replace('{until}', until)}`
  } else if (count !== null) {
    label += ` · ${t.recurrenceCountSuffix.replace('{n}', String(count))}`
  }
  return label
}
