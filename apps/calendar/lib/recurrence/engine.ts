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

/**
 * A recurrence rule in structured form. Covers the RFC 5545 fields the RRULE
 * grammar allows so that `rruleToParts` → `rruleFromParts` is LOSSLESS: any
 * transform (re-anchoring, day translation) that round-trips through this
 * type must not silently drop a constraint and quietly change which
 * occurrences a series generates.
 *
 * `byweekday` entries keep their ordinal prefix ("2MO", "-1FR") because a
 * bare "MO" means a different rule.
 */
export interface RruleParts {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  interval: number
  /** Weekday tokens, optionally ordinal-prefixed: "MO", "2MO", "-1FR". */
  byweekday: string[] | null
  bymonthday: number[] | null
  bysetpos: number[] | null
  bymonth: number[] | null
  byyearday: number[] | null
  byweekno: number[] | null
  byhour: number[] | null
  byminute: number[] | null
  bysecond: number[] | null
  /** Week start, e.g. "MO" — changes which days BYWEEKNO/WEEKLY spans cover. */
  wkst: string | null
  until: string | null
  count: number | null
}

/** A weekday token split into its ordinal prefix and day name. */
export interface WeekdayToken {
  ordinal: number | null
  day: string
}

/**
 * An otherwise-empty parts object for the given frequency. Use this instead
 * of hand-writing every field so adding a new RFC field cannot silently
 * break callers.
 */
export function emptyRruleParts(
  freq: RruleParts['freq'],
  interval = 1,
): RruleParts {
  return {
    freq,
    interval,
    byweekday: null,
    bymonthday: null,
    bysetpos: null,
    bymonth: null,
    byyearday: null,
    byweekno: null,
    byhour: null,
    byminute: null,
    bysecond: null,
    wkst: null,
    until: null,
    count: null,
  }
}

const WEEKDAY_TOKEN_RE = /^([+-]?\d{1,2})?(MO|TU|WE|TH|FR|SA|SU)$/i

export function parseWeekdayToken(token: string): WeekdayToken | null {
  const match = WEEKDAY_TOKEN_RE.exec(token.trim())
  if (!match) return null
  return {
    ordinal: match[1] !== undefined ? Number(match[1]) : null,
    day: match[2].toUpperCase(),
  }
}

export function formatWeekdayToken(token: WeekdayToken): string {
  return token.ordinal === null ? token.day : `${token.ordinal}${token.day}`
}

/**
 * Rotates a weekday token by `days`.
 *
 * A bare token ("MO") just rotates its day. An ORDINAL token ("2MO" = 2nd
 * Monday of the month) is different: "2nd Monday + 1 day" is not "2nd
 * Tuesday" in every month — when the 2nd Monday falls on the 14th, the next
 * day is that month's 3rd Tuesday. Only whole-week shifts are expressible,
 * and they move the ordinal (2nd Monday + 7d = 3rd Monday). Returns null when
 * the shift cannot be expressed, so callers refuse instead of corrupting it.
 */
function rotateWeekdayToken(token: string, days: number): string | null {
  const parsed = parseWeekdayToken(token)
  if (!parsed) return token
  const index = DAY_INDEX[parsed.day]
  if (index === undefined) return token
  if (parsed.ordinal === null) {
    return formatWeekdayToken({
      ordinal: null,
      day: DAY_NAMES[(((index + days) % 7) + 7) % 7],
    })
  }
  if (days % 7 !== 0) return null
  const shifted = parsed.ordinal + days / 7
  // Ordinal 0 is invalid, and |n| > 5 cannot occur in any month.
  if (shifted === 0 || shifted > 5 || shifted < -5) return null
  return formatWeekdayToken({ ordinal: shifted, day: parsed.day })
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

  // Occurrences are identified by a day+anchor-clock stamp, so a rule that
  // selects several times within one day (BYHOUR/BYMINUTE/BYSECOND, or a
  // sub-daily INTERVAL) would otherwise emit duplicate instances sharing one
  // recurrenceId — indistinguishable rows that break override matching and
  // render as stacked copies. Collapse them to one instance per stamp.
  const seenStamps = new Set<string>()
  const instances: RecurrenceInstance[] = []
  for (const date of occurrences) {
    const dayParts = toDayParts(date)
    const startDate = toOccurrence(date)
    const recurrenceId = isAllDay
      ? dayStamp(dayParts)
      : toRfcStamp(startDate, false)
    if (seenStamps.has(recurrenceId)) continue
    seenStamps.add(recurrenceId)
    instances.push({
      id: buildInstanceId(series.id, recurrenceId),
      seriesId: series.id,
      recurrenceId,
      startDate,
      endDate: new Date(startDate.getTime() + duration),
      isAllDay,
    })
  }
  return instances
}

/**
 * Stamp of the first VISIBLE occurrence of a series: the first generated
 * instance not removed by an exdate. Window-independent — expands from the
 * series' own start (bounded to 5 years / 12 instances), so it works for
 * series older than the expansion window. Returns null when nothing is
 * generated in the bound.
 */
export function firstVisibleStampOfSeries(
  series: RecurrenceEvent,
  timeZone?: string,
): string | null {
  if (!series.rrule || series.rrule.trim().length === 0) return null
  const start = toDate(series.startDate)
  // expandSeries generates occurrences at UTC-midnight rule slots (dtstart
  // is midnight of the anchor day), so the window must open before that
  // midnight in any timezone — two days of slack is enough, and the rule
  // never generates before its own dtstart.
  const windowStart = new Date(start.getTime() - 2 * 24 * 3600 * 1000)
  const windowEnd = new Date(start.getTime())
  windowEnd.setFullYear(windowEnd.getFullYear() + 5)
  const instances = expandSeries(series, windowStart, windowEnd, 12, timeZone)
  return instances[0]?.recurrenceId ?? null
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
      // "All events" edits are only offered on the series' first visible
      // occurrence; the marker tells the client which instance that is.
      // When the window already opens at or before the series start, the
      // window's own first instance IS that occurrence (expandSeries emits in
      // order and skips exdates), so the extra bounded expansion is skipped.
      const masterStart = toDate(master.startDate)
      const firstStamp =
        windowStart.getTime() <= masterStart.getTime()
          ? (instances[0]?.recurrenceId ?? null)
          : firstVisibleStampOfSeries(master, timeZone)
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
          ...(instance.recurrenceId === firstStamp
            ? { isFirstInstance: true }
            : {}),
        } as T)
      }
      // Overrides whose stamp matched no generated slot are still shown, so a
      // single-instance edit is never lost. NOTE: an EXDATE'd stamp that
      // still has an override row means "this occurrence was single-edited"
      // (the exdate suppresses the base slot, the override carries the edit) —
      // NOT "deleted". Deletion removes the override row as well, so the
      // override's existence is the signal. Filtering exdated overrides here
      // would silently discard every moved single-instance edit.
      // Overrides rendering outside the requested window are skipped: they
      // belong to another view's range.
      for (const override of seriesOverrides) {
        const overrideRecurrenceId = override.recurrenceId
        if (
          typeof overrideRecurrenceId !== 'string' ||
          matchedRecurrenceIds.has(overrideRecurrenceId)
        ) {
          continue
        }
        const overrideStart = new Date(
          override.startDate as unknown as string | Date,
        )
        if (
          !Number.isNaN(overrideStart.getTime()) &&
          (overrideStart.getTime() < windowStart.getTime() ||
            overrideStart.getTime() > windowEnd.getTime())
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
  // Stamp the surviving tail of the old series with the truncated rule and
  // the split-boundary exdate (mirroring the server's withUntil/masterExdate).
  // Until the response lands, these rows are the source of truth for any
  // follow-up optimistic edit — leaving the original unbounded rule on them
  // lets a second edit re-expand the old series across the new series' days.
  let truncatedRule: string | null = null
  if (targetRow.rrule) {
    try {
      truncatedRule = withUntil(targetRow.rrule, recurrenceId)
    } catch {
      truncatedRule = null
    }
  }
  const kept = current
    .filter(
      (e) =>
        (e as SeriesViewInput).seriesId !== targetSeriesId ||
        ((e as SeriesViewInput).recurrenceId ?? '') < recurrenceId,
    )
    .map((e) => {
      const row = e as SeriesViewInput
      if (row.seriesId !== targetSeriesId || truncatedRule === null) return e
      const exdate = (row.exdate ?? []).filter((s) => s <= recurrenceId)
      if (!exdate.includes(recurrenceId)) exdate.push(recurrenceId)
      return { ...e, rrule: truncatedRule, exdate }
    })
  const clockSource = new Date(master.startDate)
  // The new series inherits only the exdates after the split point, shifted
  // into its own clock space (mirroring the server's shiftedSplitExdate) —
  // carrying the old series' full exdate list would leave stale stamps that
  // no longer match the regenerated occurrences.
  let masterWithExdates: SeriesViewInput = master
  try {
    const splitDeltaMs =
      clockSource.getTime() - parseRfcStamp(recurrenceId).date.getTime()
    const movedExdates = (targetRow.exdate ?? [])
      .filter((stamp) => stamp > recurrenceId)
      .map((stamp) => shiftStamp(stamp, splitDeltaMs))
    masterWithExdates = {
      ...master,
      exdate: movedExdates.length > 0 ? movedExdates : null,
    }
  } catch {
    // Non-RFC stamp format — leave the master row exactly as passed.
  }
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
    [masterWithExdates],
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

/**
 * The ordinal-prefixed weekday token that selects exactly this date within
 * its month, e.g. 2026-08-12 (2nd Wednesday) → "2WE".
 */
function nthWeekdayTokenOf(date: Date, timeZone?: string): string {
  const parts = partsOfDate(date, timeZone)
  const nth = Math.floor((parts.day - 1) / 7) + 1
  return `${nth}${weekdayNameOf(date, timeZone)}`
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

/**
 * Whether `date`'s calendar day is selected by the rule. Delegates to rrule
 * itself (day-granular, anchored on the candidate day) instead of re-deriving
 * BY* semantics by hand — a hand-rolled matcher silently disagrees with the
 * expansion engine as soon as a rule uses BYSETPOS lists, ordinal weekdays,
 * BYWEEKNO or BYYEARDAY.
 */
function matchesParts(
  parts: RruleParts,
  date: Date,
  timeZone?: string,
): boolean {
  const dayParts = partsOfDate(date, timeZone)
  const dayStart = new Date(
    Date.UTC(dayParts.year, dayParts.month - 1, dayParts.day),
  )
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000 - 1)
  try {
    // Drop bounds and time-of-day constraints: this asks only "is this day in
    // the pattern", so COUNT/UNTIL (which limit the series' extent) and
    // BYHOUR/BYMINUTE/BYSECOND (which pick times within a day) must not
    // influence the answer.
    const unbounded: RruleParts = {
      ...parts,
      until: null,
      count: null,
      byhour: null,
      byminute: null,
      bysecond: null,
    }
    const rule = new RRule({
      ...RRule.fromString(rruleFromParts(unbounded)).origOptions,
      dtstart: dayStart,
    })
    return rule.between(dayStart, dayEnd, true).length > 0
  } catch {
    // Unparsable rule: treat the anchor as a member so callers leave it alone
    // rather than rewriting a rule they cannot reason about.
    return true
  }
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
 * Whole-calendar-day distance between two instants, measured on their wall
 * clock dates (not by milliseconds), so it is DST-safe and unaffected by the
 * time-of-day part: Mon 09:00 → Tue 15:00 is +1 day.
 */
export function wallClockDayDelta(
  from: Date,
  to: Date,
  timeZone?: string,
): number {
  const a = partsOfDate(from, timeZone)
  const b = partsOfDate(to, timeZone)
  const dayA = Date.UTC(a.year, a.month - 1, a.day)
  const dayB = Date.UTC(b.year, b.month - 1, b.day)
  return Math.round((dayB - dayA) / (24 * 3600 * 1000))
}

/**
 * Adds whole calendar days to an instant, keeping its wall-clock time of day.
 * DST-safe: 09:00 stays 09:00 even when the offset changes across the shift.
 */
export function addWallClockDays(
  date: Date,
  days: number,
  timeZone?: string,
): Date {
  const parts = partsOfDate(date, timeZone)
  const shifted = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + days),
  )
  const clock = {
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  }
  return wallClockToInstant(
    {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      ...clock,
    },
    clock,
    timeZone,
  )
}

/**
 * Translates a whole recurrence pattern by `days` calendar days and applies
 * `clockSource`'s time of day — the "all events" semantic when the anchor is
 * moved to a different weekday: every generated slot shifts by the same day
 * distance (Mon/Wed/Fri/Sun + 1 → Tue/Thu/Sat/Mon) instead of the pattern
 * collapsing onto one weekday.
 *
 * Handles each FREQ generically:
 * - WEEKLY: rotates every BYDAY entry by `days`.
 * - MONTHLY by BYMONTHDAY / YEARLY: shifts the day-of-month (and month for
 *   YEARLY) via real date arithmetic so month lengths are respected.
 * - MONTHLY by BYDAY+BYSETPOS ("2nd Tuesday"): rotates the weekday, keeping
 *   the ordinal.
 * - DAILY and rules with no day constraint: nothing to rotate — the anchor
 *   move alone carries the shift.
 *
 * Returns the rule unchanged when it cannot be parsed.
 */
export function translateRuleByDays(
  rule: string,
  days: number,
  anchorAfterShift: Date,
  isAllDay: boolean,
  timeZone?: string,
): string {
  if (days === 0) return rule
  let parts: RruleParts
  try {
    parts = rruleToParts(rule)
  } catch {
    return rule
  }

  // Refuse shapes whose shift cannot be expressed as a rule that selects the
  // same occurrences — keeping the rule intact is always safer than writing
  // an approximation (canTranslateRuleByDays lets callers reject the edit).
  if (!canTranslateParts(parts, days)) return rule

  // Every day-selecting field travels by the same distance; multi-value
  // fields are translated ELEMENT-WISE (collapsing them onto the anchor
  // would silently delete occurrences, e.g. BYMONTHDAY=1,15 → 2,16 not 4).
  if (parts.byweekday && parts.byweekday.length > 0) {
    const rotated = parts.byweekday.map((token) =>
      rotateWeekdayToken(token, days),
    )
    if (rotated.some((token) => token === null)) return rule
    parts = { ...parts, byweekday: dedupe(rotated as string[]) }
  }

  if (parts.bymonthday && parts.bymonthday.length > 0) {
    // Negative entries count back from month end ("-1" = last day) and stay
    // relative; positive entries shift by the day distance. A shift that
    // would leave the 1..31 range cannot be expressed as a plain BYMONTHDAY
    // for every month, so the rule is left alone (see canTranslateRuleByDays).
    const shifted = parts.bymonthday.map((day) =>
      day < 0 ? day - days : day + days,
    )
    if (shifted.some((day) => day === 0 || day > 31 || day < -31)) {
      return rule
    }
    parts = { ...parts, bymonthday: dedupe(shifted) }
  }

  if (parts.byyearday && parts.byyearday.length > 0) {
    const shifted = parts.byyearday.map((day) =>
      day < 0 ? day - days : day + days,
    )
    if (shifted.some((day) => day === 0 || day > 366 || day < -366)) {
      return rule
    }
    parts = { ...parts, byyearday: dedupe(shifted) }
  }

  // BYMONTH only needs adjusting when the shift pushes the anchor into
  // another month; the anchor after the shift names it. Multi-month rules
  // (quarterly etc.) are shifted element-wise by the same month distance so
  // the cadence survives.
  if (parts.bymonth && parts.bymonth.length > 0) {
    const before = partsOfDate(
      addWallClockDays(anchorAfterShift, -days, timeZone),
      timeZone,
    )
    const after = partsOfDate(anchorAfterShift, timeZone)
    const monthDelta = after.month - before.month
    if (monthDelta !== 0) {
      parts = {
        ...parts,
        bymonth: dedupe(
          parts.bymonth.map(
            (m) => ((((m - 1 + monthDelta) % 12) + 12) % 12) + 1,
          ),
        ),
      }
    }
  }

  // BYWEEKNO shifts by whole weeks only; a partial-week shift changes which
  // ISO week each occurrence lands in and cannot be expressed by rotating
  // the week number alone.
  if (parts.byweekno && parts.byweekno.length > 0) {
    if (days % 7 !== 0) {
      return rule
    }
    const weeks = days / 7
    const shifted = parts.byweekno.map((w) => (w < 0 ? w - weeks : w + weeks))
    if (shifted.some((w) => w === 0 || w > 53 || w < -53)) {
      return rule
    }
    parts = { ...parts, byweekno: dedupe(shifted) }
  }

  // An absolute UNTIL bound travels with the pattern.
  if (parts.until !== null) {
    try {
      const untilDate = parseRfcStamp(parts.until).date
      if (!Number.isNaN(untilDate.getTime())) {
        parts = {
          ...parts,
          until: toRfcStamp(
            addWallClockDays(untilDate, days, timeZone),
            isAllDay,
          ),
        }
      }
    } catch {
      // Leave a non-parsable UNTIL alone.
    }
  }

  try {
    return rruleFromParts(parts)
  } catch {
    return rule
  }
}

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values)]
}

/**
 * Whether `translateRuleByDays` can express this rule shifted by `days`
 * without changing which occurrences it selects. Callers that must not
 * silently degrade a rule (e.g. an "all events" day move) check this first
 * and reject the edit instead of writing a rule that generates a different
 * set.
 */
export function canTranslateRuleByDays(rule: string, days: number): boolean {
  if (days === 0) return true
  try {
    return canTranslateParts(rruleToParts(rule), days)
  } catch {
    return false
  }
}

/**
 * WEEKLY with INTERVAL > 1 counts whole weeks from the anchor's week. A shift
 * that is not a whole number of weeks moves some days (and possibly the
 * anchor) across the week boundary, which flips the interval's phase and
 * changes the spacing between occurrences. Such a shift has no equivalent
 * rule, so only whole-week shifts are expressible.
 */
function weeklyIntervalBlocksShift(parts: RruleParts, days: number): boolean {
  if (parts.freq !== 'WEEKLY' || parts.interval <= 1) return false
  return days % 7 !== 0
}

function canTranslateParts(parts: RruleParts, days: number): boolean {
  if (days === 0) return true
  if (weeklyIntervalBlocksShift(parts, days)) return false

  // An ordinal weekday ("2nd Monday") only shifts by whole weeks; any other
  // distance lands on a different ordinal depending on the month.
  if (
    parts.byweekday?.some((token) => rotateWeekdayToken(token, days) === null)
  ) {
    return false
  }

  // BYSETPOS picks the nth match WITHIN each period ("last Saturday of the
  // month"). Rotating the weekday keeps the same positional selection, so the
  // shifted rule lands on a date that is not the original + days: last
  // Saturday + 7d is not "last Sunday", it is a date the rule cannot name.
  if (parts.bysetpos && parts.bysetpos.length > 0) {
    return false
  }

  if (parts.bymonthday?.some((d) => d < 0)) {
    // "last day of month" + n has no fixed BYMONTHDAY equivalent.
    return false
  }
  if (
    parts.bymonthday?.some((d) => {
      const shifted = d + days
      return shifted === 0 || shifted > 31 || shifted < -31
    })
  ) {
    return false
  }
  if (parts.byyearday?.some((d) => d < 0)) return false
  if (
    parts.byyearday?.some((d) => {
      const shifted = d + days
      return shifted === 0 || shifted > 366 || shifted < -366
    })
  ) {
    return false
  }
  if (parts.byweekno && parts.byweekno.length > 0 && days % 7 !== 0) {
    return false
  }
  return true
}

/**
 * Translates recurrence stamps by whole calendar days AND applies
 * `clockSource`'s time of day — the exdate/override counterpart of
 * `translateRuleByDays`, so stored stamps keep matching the slots the
 * translated pattern generates.
 */
export function translateStampsByDays(
  stamps: string[] | null | undefined,
  days: number,
  clockSource: Date,
  timeZone?: string,
): string[] | null {
  if (!stamps || stamps.length === 0) return null
  return stamps.map((stamp) => {
    const parsed = parseRfcStamp(stamp)
    const movedDay = addWallClockDays(parsed.date, days, timeZone)
    return toRfcStamp(
      parsed.isAllDay
        ? movedDay
        : shiftToAnchorClock(movedDay, clockSource, timeZone),
      parsed.isAllDay,
    )
  })
}

/**
 * Snaps `candidate` back onto the recurrence pattern of `rule`, keeping only
 * its time of day — the "this and following" semantic: dragging Wednesday's
 * instance to Tuesday 15:00 must NOT add a Tuesday to a Mon/Wed/Fri/Sun
 * series; the split series stays on its pattern days and only adopts 15:00.
 *
 * Returns `patternDate`'s day with `candidate`'s clock. `patternDate` is the
 * occurrence the user actually dragged (its stamp is a pattern member), so
 * the result is always a valid slot.
 */
export function snapToPatternDay(
  patternDate: Date,
  candidate: Date,
  timeZone?: string,
): Date {
  return shiftToAnchorClock(patternDate, candidate, timeZone)
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
    // Make the anchor a member of the set WITHOUT discarding the other
    // selected days: a Mon/Wed/Fri series whose anchor lands on Tuesday
    // becomes Mon/Tue/Wed/Fri, not Tuesday-only. Collapsing the set would
    // silently delete every other occurrence of the series.
    if (parts.freq === 'WEEKLY') {
      const anchorDay = weekdayNameOf(anchor, timeZone)
      const existing = parts.byweekday ?? []
      // Ordinal prefixes are meaningless for WEEKLY; compare on day names.
      const hasDay = existing.some(
        (token) => parseWeekdayToken(token)?.day === anchorDay,
      )
      parts = {
        ...parts,
        byweekday: hasDay ? existing : dedupe([...existing, anchorDay]),
      }
    } else if (parts.freq === 'MONTHLY') {
      if (parts.byweekday && parts.byweekday.length > 0) {
        // An nth-weekday rule ("2nd Tuesday"): adding a raw month day would
        // mix two selection modes, so add the anchor's own nth-weekday token.
        const anchorToken = nthWeekdayTokenOf(anchor, timeZone)
        parts = {
          ...parts,
          byweekday: dedupe([...parts.byweekday, anchorToken]),
        }
      } else {
        const existing = parts.bymonthday ?? []
        parts = {
          ...parts,
          bymonthday: existing.includes(day)
            ? existing
            : dedupe([...existing, day]),
        }
      }
    } else if (parts.freq === 'YEARLY') {
      const months = parts.bymonth ?? []
      const days = parts.bymonthday ?? []
      parts = {
        ...parts,
        bymonth: months.includes(anchorParts.month)
          ? months
          : dedupe([...months, anchorParts.month]),
        ...(parts.byweekday && parts.byweekday.length > 0
          ? {
              byweekday: dedupe([
                ...parts.byweekday,
                nthWeekdayTokenOf(anchor, timeZone),
              ]),
            }
          : {
              bymonthday: days.includes(day) ? days : dedupe([...days, day]),
            }),
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
    until: parts.until ? parseRfcStamp(parts.until).date : null,
    byweekday: parts.byweekday ? parts.byweekday.map(toWeekday) : null,
    bymonthday: parts.bymonthday ?? null,
    bysetpos: parts.bysetpos ?? null,
    bymonth: parts.bymonth ?? null,
    byyearday: parts.byyearday ?? null,
    byweekno: parts.byweekno ?? null,
    byhour: parts.byhour ?? null,
    byminute: parts.byminute ?? null,
    bysecond: parts.bysecond ?? null,
    ...(parts.wkst ? { wkst: toWeekday(parts.wkst) } : {}),
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
    byweekday: toDayTokens(options.byweekday),
    bymonthday: toArrayOrNull(options.bymonthday),
    bysetpos: toArrayOrNull(options.bysetpos),
    bymonth: toArrayOrNull(options.bymonth),
    byyearday: toArrayOrNull(options.byyearday),
    byweekno: toArrayOrNull(options.byweekno),
    byhour: toArrayOrNull(options.byhour),
    byminute: toArrayOrNull(options.byminute),
    bysecond: toArrayOrNull(options.bysecond),
    wkst: toWkstName(options.wkst),
    until:
      options.until !== null && options.until !== undefined
        ? toUntilStamp(options.until)
        : null,
    count: options.count ?? null,
  }
}

function toWkstName(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return DAY_NAMES[value] ?? null
  if (typeof value === 'string') {
    const parsed = parseWeekdayToken(value)
    return parsed ? parsed.day : null
  }
  const weekday = (value as { weekday?: number }).weekday
  return typeof weekday === 'number' ? (DAY_NAMES[weekday] ?? null) : null
}

/**
 * Builds an rrule Weekday, honouring an ordinal prefix ("2MO" → 2nd Monday,
 * "-1FR" → last Friday). A bare day name yields the plain weekday.
 */
function toWeekday(token: string): Weekday {
  const parsed = parseWeekdayToken(token)
  if (!parsed) {
    throw new Error(`Invalid weekday: ${token}`)
  }
  const index = DAY_INDEX[parsed.day]
  if (index === undefined) {
    throw new Error(`Invalid weekday: ${token}`)
  }
  const base = WEEKDAYS[index]
  return parsed.ordinal === null ? base : base.nth(parsed.ordinal)
}

/**
 * Reads rrule's byweekday into tokens that KEEP their ordinal prefix — a
 * "2MO" flattened to "MO" is a different rule (2nd Monday vs every Monday).
 */
function toDayTokens(value: unknown): string[] | null {
  if (value === null || value === undefined) {
    return null
  }
  const list = Array.isArray(value) ? value : [value]
  const tokens: string[] = []
  for (const entry of list) {
    if (typeof entry === 'string') {
      const parsed = parseWeekdayToken(entry)
      tokens.push(parsed ? formatWeekdayToken(parsed) : entry.toUpperCase())
      continue
    }
    if (typeof entry === 'number') {
      const name = DAY_NAMES[entry]
      if (name) tokens.push(name)
      continue
    }
    const obj = entry as { weekday?: number; n?: number }
    if (typeof obj?.weekday !== 'number') continue
    const name = DAY_NAMES[obj.weekday]
    if (!name) continue
    tokens.push(
      formatWeekdayToken({
        ordinal: typeof obj.n === 'number' && obj.n !== 0 ? obj.n : null,
        day: name,
      }),
    )
  }
  return tokens.length > 0 ? tokens : null
}

function toArrayOrNull(
  value: number | number[] | null | undefined,
): number[] | null {
  if (value === null || value === undefined) {
    return null
  }
  return Array.isArray(value) ? value.slice() : [value]
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
      const dayNames = byweekday
        .map((token) => parseWeekdayToken(token)?.day)
        .filter((day): day is string => day !== undefined)
      const days = dayNames
        .slice()
        .sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b])
        .map((d) =>
          isZh ? ZH_WEEKDAYS[DAY_INDEX[d]] : EN_WEEKDAYS[DAY_INDEX[d]],
        )
        .join(isZh ? '、' : ', ')
      if (days.length > 0) label += ` · ${days}`
    }
  } else if (freq === 'MONTHLY') {
    label = i > 1 ? everyMonths : t.repeatFrequencyMonthly
    // The ordinal can live either in BYSETPOS or as a weekday prefix ("2MO").
    const firstWeekday =
      byweekday !== null && byweekday.length > 0
        ? parseWeekdayToken(byweekday[0])
        : null
    const setPos = bysetpos?.[0] ?? firstWeekday?.ordinal ?? null
    if (setPos !== null && firstWeekday !== null) {
      const ord =
        setPos === -1
          ? t.recurrenceLastWeek
          : t.recurrenceNthWeek.replace('{n}', String(setPos))
      const day = isZh
        ? ZH_WEEKDAY_SHORT[DAY_INDEX[firstWeekday.day]]
        : EN_WEEKDAYS[DAY_INDEX[firstWeekday.day]]
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
