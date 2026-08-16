import { RRule, RRuleSet } from 'rrule'
import type { Frequency, Options, Weekday } from 'rrule'

export const MAX_EXPANSION = 1000

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
  const base = `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`
  if (isAllDay) {
    return base
  }
  return `${base}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
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

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

function utcMidnight(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
}

function parseRfcStamps(stamps: string[] | null): Date[] {
  if (!stamps) {
    return []
  }
  const dates: Date[] = []
  for (const stamp of stamps) {
    try {
      dates.push(parseRfcStamp(stamp).date)
    } catch {
      // malformed exdates are skipped
    }
  }
  return dates
}

export function expandSeries(
  series: RecurrenceEvent,
  windowStart: Date,
  windowEnd: Date,
  max = MAX_EXPANSION,
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
  const dtstart = isAllDay ? utcMidnight(start) : start

  let occurrences: Date[] = []
  try {
    const parsed = RRule.fromString(rruleString.trim())
    const rule = new RRule({ ...parsed.origOptions, dtstart })
    const exdates = parseRfcStamps(series.exdate)
    if (exdates.length > 0) {
      const set = new RRuleSet()
      set.rrule(rule)
      for (const exdate of exdates) {
        set.exdate(exdate)
      }
      occurrences = set.between(windowStart, windowEnd, true)
    } else {
      occurrences = rule.between(windowStart, windowEnd, true)
    }
  } catch {
    occurrences = []
  }

  const included = new Set(occurrences.map((date) => date.getTime()))
  const dtstartTime = dtstart.getTime()
  if (
    dtstartTime >= windowFrom &&
    dtstartTime <= windowTo &&
    !included.has(dtstartTime)
  ) {
    occurrences.unshift(dtstart)
  }

  const exdateStamps = new Set(series.exdate ?? [])
  occurrences = occurrences.filter(
    (date) => !exdateStamps.has(toRfcStamp(date, isAllDay)),
  )

  if (max > 0 && occurrences.length > max) {
    occurrences = occurrences.slice(0, max)
  }

  return occurrences.map((date) => {
    const recurrenceId = toRfcStamp(date, isAllDay)
    return {
      id: buildInstanceId(series.id, recurrenceId),
      seriesId: series.id,
      recurrenceId,
      startDate: date,
      endDate: new Date(date.getTime() + duration),
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
): string {
  const parsed = RRule.fromString(rule)
  const dtstart = newStartIsAllDay ? utcMidnight(newStartDate) : newStartDate
  const parts = { ...parsed.origOptions, dtstart, until: null, count: null }
  return toRruleLine(new RRule(parts))
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
  let label: string
  if (freq === 'DAILY') {
    label =
      i > 1
        ? isZh
          ? `每 ${i} 天`
          : `Every ${i} days`
        : isZh
          ? '每天'
          : 'Daily'
  } else if (freq === 'WEEKLY') {
    label =
      i > 1
        ? isZh
          ? `每 ${i} 周`
          : `Every ${i} weeks`
        : isZh
          ? '每周'
          : 'Weekly'
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
    label =
      i > 1
        ? isZh
          ? `每 ${i} 个月`
          : `Every ${i} months`
        : isZh
          ? '每月'
          : 'Monthly'
    if (bysetpos !== null && byweekday !== null && byweekday.length > 0) {
      const ord =
        bysetpos === -1
          ? isZh
            ? '最后一个'
            : 'last'
          : isZh
            ? `第${bysetpos}个`
            : ordinal(bysetpos)
      const day = isZh
        ? ZH_WEEKDAY_SHORT[DAY_INDEX[byweekday[0].toUpperCase()]]
        : EN_WEEKDAYS[DAY_INDEX[byweekday[0].toUpperCase()]]
      label += isZh ? ` · ${ord}周${day}` : ` · ${ord} ${day}`
    } else if (bymonthday !== null && bymonthday.length > 0) {
      label += isZh ? ` · ${bymonthday[0]} 日` : ` · ${ordinal(bymonthday[0])}`
    }
  } else {
    label =
      i > 1
        ? isZh
          ? `每 ${i} 年`
          : `Every ${i} years`
        : isZh
          ? '每年'
          : 'Yearly'
    if (bymonth !== null && bymonth.length > 0) {
      const month = bymonth[0]
      const day = bymonthday?.[0] ?? 1
      label += isZh
        ? ` · ${month} 月 ${day} 日`
        : ` · ${EN_MONTHS[month - 1]} ${day}`
    }
  }
  if (until !== null) {
    label += isZh ? ` · 至 ${until}` : ` · until ${until}`
  } else if (count !== null) {
    label += isZh ? ` · 共 ${count} 次` : ` · ${count} times`
  }
  return label
}
