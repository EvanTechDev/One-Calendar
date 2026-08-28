/**
 * MCP analytics tools — expose the shared analytics engine
 * (`@/lib/analytics/engine`) to AI agents.
 *
 * These tools never decrypt title/description/location: every metric derives
 * from structural columns only (dates, category id, all-day flag, createdAt).
 * That keeps the analytics path fast and avoids handling plaintext content
 * for a purely statistical feature.
 */
import { getDb } from '@/lib/drizzle/client'
import { calendarEvents, calendarCategories } from '@/lib/drizzle/schema'
import { eq, and, lt, gt, or, isNotNull } from 'drizzle-orm'
import { expandRows, type EventRow } from '@/lib/event-service'
import {
  compareSummaries,
  computeDistribution,
  computeInsights,
  computeSummary,
  previousRange,
  resolveRelativeRange,
  UNCATEGORIZED_ID,
  type AnalyticsEngineEvent,
  type AnalyticsRange,
} from '@/lib/analytics/engine'
import { InvalidEventQueryError } from './errors'
import { getSettings } from './settings-tools'

export interface AnalyticsRangeParams {
  /** Relative window in days ending today (mutually exclusive with start/end). */
  days?: number
  start_date?: string
  end_date?: string
  timezone?: string
}

const MAX_RANGE_DAYS = 366

async function resolveTimezone(
  userId: string,
  override?: string,
): Promise<string | undefined> {
  if (override) return override
  const settings = await getSettings(userId)
  const timezone = (settings as Record<string, unknown>).timezone
  return typeof timezone === 'string' && timezone.length > 0
    ? timezone
    : undefined
}

export async function resolveAnalyticsRange(
  userId: string,
  params: AnalyticsRangeParams,
): Promise<{ range: AnalyticsRange; timeZone: string | undefined }> {
  const timeZone = await resolveTimezone(userId, params.timezone)

  if (params.days !== undefined && (params.start_date || params.end_date)) {
    throw new InvalidEventQueryError(
      'Pass either days or start_date/end_date, not both',
    )
  }

  if (params.start_date || params.end_date) {
    if (!params.start_date || !params.end_date) {
      throw new InvalidEventQueryError(
        'start_date and end_date must be provided together',
      )
    }
    const start = new Date(params.start_date)
    const end = new Date(params.end_date)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new InvalidEventQueryError('Invalid start_date or end_date')
    }
    if (end <= start) {
      throw new InvalidEventQueryError('end_date must be after start_date')
    }
    const lengthDays = (end.getTime() - start.getTime()) / 86_400_000
    if (lengthDays > MAX_RANGE_DAYS) {
      throw new InvalidEventQueryError(
        `Range too large: max ${MAX_RANGE_DAYS} days`,
      )
    }
    return { range: { start, end }, timeZone }
  }

  const days = params.days ?? 30
  if (!Number.isInteger(days) || days < 1 || days > MAX_RANGE_DAYS) {
    throw new InvalidEventQueryError(
      `days must be an integer between 1 and ${MAX_RANGE_DAYS}`,
    )
  }
  return {
    range: resolveRelativeRange(days, new Date(), timeZone),
    timeZone,
  }
}

/**
 * Loads the user's events overlapping the window and expands recurring
 * series into concrete occurrences — WITHOUT decrypting content fields.
 * Encrypted envelopes ride along untouched and are dropped by the mapping
 * to `AnalyticsEngineEvent`.
 */
export async function loadEngineEvents(
  userId: string,
  window: AnalyticsRange,
): Promise<AnalyticsEngineEvent[]> {
  const db = await getDb()

  const plainRows = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.userId, userId),
        lt(calendarEvents.startDate, window.end),
        gt(calendarEvents.endDate, window.start),
      ),
    )

  // Recurring masters and their overrides must be fetched regardless of the
  // window: a master whose anchor date is outside the window can still
  // generate occurrences inside it.
  const recurringRows = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.userId, userId),
        or(isNotNull(calendarEvents.rrule), isNotNull(calendarEvents.seriesId)),
      ),
    )

  const recurringIds = new Set(recurringRows.map((row) => row.id))
  const toEventRow = (row: typeof calendarEvents.$inferSelect): EventRow => ({
    ...row,
    // Participants stay encrypted; analytics never reads them.
    participants: [],
  })

  const rows: EventRow[] = [
    ...plainRows.filter((row) => !recurringIds.has(row.id)).map(toEventRow),
    ...recurringRows.map(toEventRow),
  ]

  const expanded = expandRows(rows, {
    windowStart: window.start,
    windowEnd: window.end,
  })

  return expanded.map((row) => ({
    id: row.instanceId,
    start: row.startDate,
    end: row.endDate,
    categoryId: row.categoryId,
    isAllDay: row.isAllDay,
    createdAt: row.createdAt,
  }))
}

async function loadCategoryNames(userId: string): Promise<Map<string, string>> {
  const db = await getDb()
  const rows = await db
    .select({
      id: calendarCategories.id,
      name: calendarCategories.name,
    })
    .from(calendarCategories)
    .where(eq(calendarCategories.userId, userId))
  return new Map(rows.map((row) => [row.id, row.name]))
}

export interface GetAnalyticsSummaryParams extends AnalyticsRangeParams {
  compare_previous_period?: boolean
  /** Resolve category ids to names; requires categories:read (checked by caller). */
  include_category_names?: boolean
}

export async function getAnalyticsSummary(
  userId: string,
  params: GetAnalyticsSummaryParams = {},
) {
  const { range, timeZone } = await resolveAnalyticsRange(userId, params)
  const compare = params.compare_previous_period ?? true
  const prevRange = previousRange(range)
  const window = compare ? { start: prevRange.start, end: range.end } : range

  const events = await loadEngineEvents(userId, window)
  const summary = computeSummary(events, range, { timeZone })

  let names: Map<string, string> | null = null
  if (params.include_category_names) {
    names = await loadCategoryNames(userId)
  }
  const byCategory = summary.byCategory.map((item) => ({
    ...item,
    ...(names
      ? {
          categoryName:
            item.categoryId === UNCATEGORIZED_ID
              ? null
              : (names.get(item.categoryId) ?? null),
        }
      : {}),
  }))

  if (!compare) {
    return { ...summary, byCategory, timezone: timeZone ?? 'server-local' }
  }

  const previousSummary = computeSummary(events, prevRange, { timeZone })
  return {
    ...summary,
    byCategory,
    timezone: timeZone ?? 'server-local',
    comparison: compareSummaries(summary, previousSummary),
    previousRange: {
      rangeStart: previousSummary.rangeStart,
      rangeEnd: previousSummary.rangeEnd,
      totalEvents: previousSummary.totalEvents,
      scheduledHours: previousSummary.scheduledHours,
      busyDays: previousSummary.busyDays,
    },
  }
}

export async function getTimeDistribution(
  userId: string,
  params: AnalyticsRangeParams = {},
) {
  const { range, timeZone } = await resolveAnalyticsRange(userId, params)
  const events = await loadEngineEvents(userId, range)
  const distribution = computeDistribution(events, range, { timeZone })
  return {
    rangeStart: range.start.toISOString(),
    rangeEnd: range.end.toISOString(),
    timezone: timeZone ?? 'server-local',
    weekdayLegend: 'weekday 0 = Monday … 6 = Sunday',
    ...distribution,
  }
}

export interface GetAnalyticsInsightsParams extends AnalyticsRangeParams {
  /** Resolve category ids to names; requires categories:read (checked by caller). */
  include_category_names?: boolean
}

export async function getAnalyticsInsights(
  userId: string,
  params: GetAnalyticsInsightsParams = {},
) {
  const { range, timeZone } = await resolveAnalyticsRange(userId, params)
  // Insights compare against the previous period, so load both.
  const window = { start: previousRange(range).start, end: range.end }
  const events = await loadEngineEvents(userId, window)
  const insights = computeInsights(events, range, { timeZone })

  let names: Map<string, string> | null = null
  if (
    params.include_category_names &&
    insights.some((insight) => insight.type === 'category_shift')
  ) {
    names = await loadCategoryNames(userId)
  }

  return {
    rangeStart: range.start.toISOString(),
    rangeEnd: range.end.toISOString(),
    timezone: timeZone ?? 'server-local',
    insights: insights.map((insight) =>
      insight.type === 'category_shift' && names
        ? {
            ...insight,
            data: {
              ...insight.data,
              categoryName:
                insight.data.categoryId === UNCATEGORIZED_ID
                  ? null
                  : (names.get(insight.data.categoryId) ?? null),
            },
          }
        : insight,
    ),
  }
}
