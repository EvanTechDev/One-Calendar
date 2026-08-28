/**
 * Shared analytics engine — the single owner of schedule-analytics
 * computation. Both the web analytics view and the MCP analytics tools feed
 * events into these pure functions, so a number shown in the UI and a number
 * returned to an AI agent can never drift apart.
 *
 * The engine never touches encrypted fields (title/description/location):
 * every metric derives from dates, category ids and the all-day flag, which
 * is what lets the MCP tools skip decryption entirely.
 */
import { partsInLocal, partsInTz } from '@/lib/recurrence/engine'

export interface AnalyticsEngineEvent {
  id: string
  start: Date
  end: Date
  categoryId: string | null
  isAllDay: boolean
  /** When the event row was created; enables planning-lead-time insights. */
  createdAt?: Date
}

export interface AnalyticsRange {
  start: Date
  end: Date
}

export interface CategoryBreakdown {
  categoryId: string
  count: number
  hours: number
  sharePct: number
}

export interface AnalyticsSummary {
  rangeStart: string
  rangeEnd: string
  totalDays: number
  totalEvents: number
  allDayEvents: number
  scheduledHours: number
  busyDays: number
  avgEventsPerDay: number
  avgDurationMinutes: number
  byCategory: CategoryBreakdown[]
}

export interface MetricDelta {
  current: number
  previous: number
  /** Percentage change vs previous; null when the previous value is 0. */
  changePct: number | null
}

export interface AnalyticsComparison {
  totalEvents: MetricDelta
  scheduledHours: MetricDelta
  busyDays: MetricDelta
  avgDurationMinutes: MetricDelta
}

export interface TimeDistribution {
  /** weekday 0 = Monday … 6 = Sunday */
  byWeekday: { weekday: number; count: number; hours: number }[]
  /** Start-hour histogram over timed (non-all-day) events. */
  byHour: { hour: number; count: number }[]
  /** [weekday][hour] counts over timed events. */
  punchCard: number[][]
  /** Densest 2-hour start window among timed events. */
  peakWindow: { startHour: number; sharePct: number } | null
}

export type InsightSeverity = 'info' | 'positive' | 'warning'

export type AnalyticsInsight =
  | {
      type: 'volume_trend'
      severity: InsightSeverity
      data: { currentCount: number; previousCount: number; changePct: number }
    }
  | {
      type: 'busiest_weekday'
      severity: InsightSeverity
      data: { weekday: number; sharePct: number }
    }
  | {
      type: 'overloaded_days'
      severity: InsightSeverity
      data: { days: number; thresholdHours: number; maxHours: number }
    }
  | {
      type: 'long_streak'
      severity: InsightSeverity
      data: { days: number; startDate: string; endDate: string }
    }
  | {
      type: 'no_free_days'
      severity: InsightSeverity
      data: { days: number }
    }
  | {
      type: 'fragmented'
      severity: InsightSeverity
      data: { shortPct: number; thresholdMinutes: number }
    }
  | {
      type: 'category_shift'
      severity: InsightSeverity
      data: { categoryId: string; fromPct: number; toPct: number }
    }
  | {
      type: 'peak_hours'
      severity: InsightSeverity
      data: { startHour: number; endHour: number; sharePct: number }
    }
  | {
      type: 'free_weekday'
      severity: InsightSeverity
      data: { weekday: number }
    }
  | {
      type: 'planning_ahead'
      severity: InsightSeverity
      data: { avgLeadDays: number }
    }
  | {
      type: 'spontaneous'
      severity: InsightSeverity
      data: { avgLeadDays: number }
    }

export interface EngineOptions {
  /** IANA timezone for day/hour bucketing; defaults to the runtime's local zone. */
  timeZone?: string
}

export const UNCATEGORIZED_ID = 'uncategorized'

/** Thresholds for the rule-based insights, exported for UI copy and tests. */
export const INSIGHT_THRESHOLDS = {
  volumeChangePct: 20,
  overloadHours: 8,
  shortEventMinutes: 30,
  fragmentedSharePct: 40,
  categoryShiftPp: 15,
  peakWindowSharePct: 30,
  streakDays: 3,
  planningAheadDays: 7,
  spontaneousDays: 1,
} as const

const MS_PER_HOUR = 3_600_000
const MS_PER_DAY = 86_400_000
/** Ignore pathological durations (e.g. wrong-year end dates) beyond a day. */
const MAX_EVENT_HOURS = 24

const pad2 = (value: number): string =>
  value < 10 ? `0${value}` : String(value)

function parts(date: Date, timeZone?: string) {
  return timeZone ? partsInTz(date, timeZone) : partsInLocal(date)
}

export function dayKeyOf(date: Date, timeZone?: string): string {
  const p = parts(date, timeZone)
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`
}

/** 0 = Monday … 6 = Sunday, in the requested timezone. */
export function weekdayOf(date: Date, timeZone?: string): number {
  const p = parts(date, timeZone)
  const utcDay = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()
  return utcDay === 0 ? 6 : utcDay - 1
}

export function hourOf(date: Date, timeZone?: string): number {
  return parts(date, timeZone).hour
}

/**
 * Whole-day range covering the last `days` days (inclusive of today) in the
 * given timezone: [start of day (days-1) ago, end of today].
 */
export function resolveRelativeRange(
  days: number,
  now: Date,
  timeZone?: string,
): AnalyticsRange {
  const p = parts(now, timeZone)
  const todayUtcMidnight = Date.UTC(p.year, p.month - 1, p.day)
  const startParts = new Date(todayUtcMidnight - (days - 1) * MS_PER_DAY)
  const endParts = new Date(todayUtcMidnight + MS_PER_DAY)
  const toInstant = (d: Date): Date => {
    if (!timeZone) {
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    }
    // Convert the wall-clock midnight to an instant in the target zone by
    // probing the zone's offset at the naive UTC time (DST-safe enough for
    // day-level analytics bucketing).
    const naive = d.getTime()
    const probe = parts(new Date(naive), timeZone)
    const probeUtc = Date.UTC(
      probe.year,
      probe.month - 1,
      probe.day,
      probe.hour,
      probe.minute,
      probe.second,
    )
    return new Date(naive - (probeUtc - naive))
  }
  return {
    start: toInstant(startParts),
    end: new Date(toInstant(endParts).getTime() - 1),
  }
}

export function previousRange(range: AnalyticsRange): AnalyticsRange {
  const length = range.end.getTime() - range.start.getTime()
  const end = new Date(range.start.getTime() - 1)
  return { start: new Date(end.getTime() - length), end }
}

export function filterByStart(
  events: AnalyticsEngineEvent[],
  range: AnalyticsRange,
): AnalyticsEngineEvent[] {
  return events.filter(
    (event) => event.start >= range.start && event.start <= range.end,
  )
}

/** Duration in hours, clipped to the range and capped at 24h per event. */
function clippedHours(
  event: AnalyticsEngineEvent,
  range: AnalyticsRange,
): number {
  const start = Math.max(event.start.getTime(), range.start.getTime())
  const end = Math.min(event.end.getTime(), range.end.getTime())
  const hours = (end - start) / MS_PER_HOUR
  return Math.min(Math.max(hours, 0), MAX_EVENT_HOURS)
}

const round1 = (value: number): number => Math.round(value * 10) / 10

export function computeSummary(
  events: AnalyticsEngineEvent[],
  range: AnalyticsRange,
  opts: EngineOptions = {},
): AnalyticsSummary {
  const inRange = filterByStart(events, range)
  const totalDays = Math.max(
    1,
    Math.round((range.end.getTime() - range.start.getTime()) / MS_PER_DAY),
  )

  const busyDayKeys = new Set<string>()
  const byCategory = new Map<string, { count: number; hours: number }>()
  let scheduledHours = 0
  let timedCount = 0
  let timedMinutes = 0
  let allDayEvents = 0

  for (const event of inRange) {
    busyDayKeys.add(dayKeyOf(event.start, opts.timeZone))
    const categoryId = event.categoryId || UNCATEGORIZED_ID
    const bucket = byCategory.get(categoryId) ?? { count: 0, hours: 0 }
    bucket.count += 1

    if (event.isAllDay) {
      allDayEvents += 1
    } else {
      const hours = clippedHours(event, range)
      scheduledHours += hours
      bucket.hours += hours
      timedCount += 1
      timedMinutes += hours * 60
    }
    byCategory.set(categoryId, bucket)
  }

  const total = inRange.length
  return {
    rangeStart: range.start.toISOString(),
    rangeEnd: range.end.toISOString(),
    totalDays,
    totalEvents: total,
    allDayEvents,
    scheduledHours: round1(scheduledHours),
    busyDays: busyDayKeys.size,
    avgEventsPerDay: round1(total / totalDays),
    avgDurationMinutes:
      timedCount === 0 ? 0 : Math.round(timedMinutes / timedCount),
    byCategory: Array.from(byCategory.entries())
      .map(([categoryId, value]) => ({
        categoryId,
        count: value.count,
        hours: round1(value.hours),
        sharePct: total === 0 ? 0 : round1((value.count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count),
  }
}

function delta(current: number, previous: number): MetricDelta {
  return {
    current,
    previous,
    changePct:
      previous === 0 ? null : round1(((current - previous) / previous) * 100),
  }
}

export function compareSummaries(
  current: AnalyticsSummary,
  previous: AnalyticsSummary,
): AnalyticsComparison {
  return {
    totalEvents: delta(current.totalEvents, previous.totalEvents),
    scheduledHours: delta(current.scheduledHours, previous.scheduledHours),
    busyDays: delta(current.busyDays, previous.busyDays),
    avgDurationMinutes: delta(
      current.avgDurationMinutes,
      previous.avgDurationMinutes,
    ),
  }
}

export function computeDistribution(
  events: AnalyticsEngineEvent[],
  range: AnalyticsRange,
  opts: EngineOptions = {},
): TimeDistribution {
  const inRange = filterByStart(events, range)
  const weekdayCount = Array.from({ length: 7 }, () => 0)
  const weekdayHours = Array.from({ length: 7 }, () => 0)
  const hourCount = Array.from({ length: 24 }, () => 0)
  const punchCard = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0),
  )

  let timedTotal = 0
  for (const event of inRange) {
    const weekday = weekdayOf(event.start, opts.timeZone)
    weekdayCount[weekday] += 1
    if (event.isAllDay) continue
    const hour = hourOf(event.start, opts.timeZone)
    weekdayHours[weekday] += clippedHours(event, range)
    hourCount[hour] += 1
    punchCard[weekday][hour] += 1
    timedTotal += 1
  }

  let peakWindow: TimeDistribution['peakWindow'] = null
  if (timedTotal > 0) {
    let bestHour = 0
    let bestCount = -1
    for (let hour = 0; hour < 24; hour += 1) {
      const count = hourCount[hour] + hourCount[(hour + 1) % 24]
      if (count > bestCount) {
        bestCount = count
        bestHour = hour
      }
    }
    peakWindow = {
      startHour: bestHour,
      sharePct: round1((bestCount / timedTotal) * 100),
    }
  }

  return {
    byWeekday: weekdayCount.map((count, weekday) => ({
      weekday,
      count,
      hours: round1(weekdayHours[weekday]),
    })),
    byHour: hourCount.map((count, hour) => ({ hour, count })),
    punchCard,
    peakWindow,
  }
}

function longestBusyStreak(
  events: AnalyticsEngineEvent[],
  range: AnalyticsRange,
  timeZone?: string,
): { days: number; startKey: string; endKey: string } {
  const busy = new Set(events.map((event) => dayKeyOf(event.start, timeZone)))
  let best = 0
  let bestStart = ''
  let bestEnd = ''
  let current = 0
  let currentStart = ''
  for (
    let cursor = range.start.getTime();
    cursor <= range.end.getTime();
    cursor += MS_PER_DAY
  ) {
    const key = dayKeyOf(new Date(cursor), timeZone)
    if (busy.has(key)) {
      if (current === 0) currentStart = key
      current += 1
      if (current > best) {
        best = current
        bestStart = currentStart
        bestEnd = key
      }
    } else {
      current = 0
    }
  }
  return { days: best, startKey: bestStart, endKey: bestEnd }
}

export function computeInsights(
  events: AnalyticsEngineEvent[],
  range: AnalyticsRange,
  opts: EngineOptions = {},
): AnalyticsInsight[] {
  const T = INSIGHT_THRESHOLDS
  const timeZone = opts.timeZone
  const current = filterByStart(events, range)
  const prevRange = previousRange(range)
  const prev = filterByStart(events, prevRange)
  const insights: AnalyticsInsight[] = []

  // 1. Volume trend vs previous period.
  if (prev.length >= 3) {
    const changePct = ((current.length - prev.length) / prev.length) * 100
    if (Math.abs(changePct) >= T.volumeChangePct) {
      insights.push({
        type: 'volume_trend',
        severity: 'info',
        data: {
          currentCount: current.length,
          previousCount: prev.length,
          changePct: round1(changePct),
        },
      })
    }
  }

  // 2. Overloaded days: too many scheduled hours in a single day.
  const hoursByDay = new Map<string, number>()
  for (const event of current) {
    if (event.isAllDay) continue
    const key = dayKeyOf(event.start, timeZone)
    hoursByDay.set(key, (hoursByDay.get(key) ?? 0) + clippedHours(event, range))
  }
  const overloaded = [...hoursByDay.values()].filter(
    (hours) => hours >= T.overloadHours,
  )
  if (overloaded.length > 0) {
    insights.push({
      type: 'overloaded_days',
      severity: 'warning',
      data: {
        days: overloaded.length,
        thresholdHours: T.overloadHours,
        maxHours: round1(Math.max(...overloaded)),
      },
    })
  }

  // 3. Busy-day streak / no rest days.
  const streak = longestBusyStreak(current, range, timeZone)
  const totalDays = Math.max(
    1,
    Math.round((range.end.getTime() - range.start.getTime()) / MS_PER_DAY),
  )
  if (streak.days >= totalDays && totalDays >= 7) {
    insights.push({
      type: 'no_free_days',
      severity: 'warning',
      data: { days: streak.days },
    })
  } else if (streak.days >= T.streakDays) {
    insights.push({
      type: 'long_streak',
      severity: 'info',
      data: {
        days: streak.days,
        startDate: streak.startKey,
        endDate: streak.endKey,
      },
    })
  }

  // 4. Fragmentation: a large share of very short events.
  const timed = current.filter((event) => !event.isAllDay)
  if (timed.length >= 8) {
    const short = timed.filter(
      (event) =>
        (event.end.getTime() - event.start.getTime()) / 60000 <=
        T.shortEventMinutes,
    )
    const shortPct = (short.length / timed.length) * 100
    if (shortPct >= T.fragmentedSharePct) {
      insights.push({
        type: 'fragmented',
        severity: 'warning',
        data: {
          shortPct: round1(shortPct),
          thresholdMinutes: T.shortEventMinutes,
        },
      })
    }
  }

  // 5. Category shift vs previous period.
  if (current.length >= 5 && prev.length >= 5) {
    const share = (list: AnalyticsEngineEvent[]): Map<string, number> => {
      const counts = new Map<string, number>()
      for (const event of list) {
        const id = event.categoryId || UNCATEGORIZED_ID
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }
      const result = new Map<string, number>()
      for (const [id, count] of counts) {
        result.set(id, (count / list.length) * 100)
      }
      return result
    }
    const currentShare = share(current)
    const prevShare = share(prev)
    let bestCategory: string | null = null
    let bestDiff = 0
    const ids = new Set([...currentShare.keys(), ...prevShare.keys()])
    for (const id of ids) {
      const diff = (currentShare.get(id) ?? 0) - (prevShare.get(id) ?? 0)
      if (Math.abs(diff) > Math.abs(bestDiff)) {
        bestDiff = diff
        bestCategory = id
      }
    }
    if (bestCategory !== null && Math.abs(bestDiff) >= T.categoryShiftPp) {
      insights.push({
        type: 'category_shift',
        severity: 'info',
        data: {
          categoryId: bestCategory,
          fromPct: round1(prevShare.get(bestCategory) ?? 0),
          toPct: round1(currentShare.get(bestCategory) ?? 0),
        },
      })
    }
  }

  // 6. Busiest weekday by scheduled hours (falls back to counts).
  if (current.length >= 5) {
    const distribution = computeDistribution(current, range, opts)
    const totalHours = distribution.byWeekday.reduce(
      (sum, day) => sum + day.hours,
      0,
    )
    const metric = totalHours > 0 ? 'hours' : 'count'
    const busiest = distribution.byWeekday.reduce((max, day) =>
      day[metric] > max[metric] ? day : max,
    )
    const total =
      metric === 'hours'
        ? totalHours
        : distribution.byWeekday.reduce((sum, day) => sum + day.count, 0)
    if (total > 0 && busiest[metric] > 0) {
      insights.push({
        type: 'busiest_weekday',
        severity: 'info',
        data: {
          weekday: busiest.weekday,
          sharePct: round1((busiest[metric] / total) * 100),
        },
      })
    }

    // 7. Peak start-hours window.
    if (
      distribution.peakWindow &&
      timed.length >= 5 &&
      distribution.peakWindow.sharePct >= T.peakWindowSharePct
    ) {
      insights.push({
        type: 'peak_hours',
        severity: 'info',
        data: {
          startHour: distribution.peakWindow.startHour,
          endHour: (distribution.peakWindow.startHour + 2) % 24,
          sharePct: distribution.peakWindow.sharePct,
        },
      })
    }

    // 8. Consistently free weekday.
    if (current.length >= 10 && totalDays >= 14) {
      const free = distribution.byWeekday.find((day) => day.count === 0)
      if (free) {
        insights.push({
          type: 'free_weekday',
          severity: 'positive',
          data: { weekday: free.weekday },
        })
      }
    }
  }

  // 9. Planning lead time; only when creation timestamps are meaningful.
  const withLead = current.filter(
    (event) =>
      event.createdAt !== undefined &&
      event.createdAt.getTime() < event.start.getTime(),
  )
  if (current.length >= 5 && withLead.length >= current.length / 2) {
    const avgLeadDays =
      withLead.reduce(
        (sum, event) =>
          sum +
          (event.start.getTime() - (event.createdAt as Date).getTime()) /
            MS_PER_DAY,
        0,
      ) / withLead.length
    if (avgLeadDays >= T.planningAheadDays) {
      insights.push({
        type: 'planning_ahead',
        severity: 'positive',
        data: { avgLeadDays: round1(avgLeadDays) },
      })
    } else if (avgLeadDays <= T.spontaneousDays) {
      insights.push({
        type: 'spontaneous',
        severity: 'info',
        data: { avgLeadDays: round1(avgLeadDays) },
      })
    }
  }

  const severityOrder: Record<InsightSeverity, number> = {
    warning: 0,
    info: 1,
    positive: 2,
  }
  return insights.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  )
}
