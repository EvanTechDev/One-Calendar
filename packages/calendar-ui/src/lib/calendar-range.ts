import { fromCalendarDate, toCalendarDate } from './zoned-date'

// Two years on either side, including the anchor month and timezone padding.
export const MAX_CALENDAR_RANGE_MS = 1500 * 86400000

export interface CalendarLoadRange {
  startDate: string
  endDate: string
  timezone: string
}

/** Whole visible period plus neighboring months. Dates here are civil UI dates. */
export function calendarLoadRange(
  date: Date,
  view: string,
  timezone: string,
): CalendarLoadRange {
  const year = date.getFullYear()
  const month = date.getMonth()
  const start =
    view === 'year' ? new Date(year, -1, 1) : new Date(year, month - 1, 1)
  const end =
    view === 'year' ? new Date(year + 1, 1, 1) : new Date(year, month + 2, 1)
  return civilRange(start, end, timezone)
}

/** A stable, four-year preload window centered on the requested view. */
export function calendarPreloadRange(
  visible: CalendarLoadRange,
): CalendarLoadRange {
  const middle = toCalendarDate(
    new Date((Date.parse(visible.startDate) + Date.parse(visible.endDate)) / 2),
    visible.timezone,
  )
  return civilRange(
    new Date(middle.getFullYear() - 2, middle.getMonth(), 1),
    new Date(middle.getFullYear() + 2, middle.getMonth() + 1, 1),
    visible.timezone,
  )
}

export function containsCalendarRange(
  loaded: CalendarLoadRange,
  visible: CalendarLoadRange,
) {
  return (
    loaded.timezone === visible.timezone &&
    Date.parse(loaded.startDate) <= Date.parse(visible.startDate) &&
    Date.parse(loaded.endDate) >= Date.parse(visible.endDate)
  )
}

function civilRange(
  start: Date,
  end: Date,
  timezone: string,
): CalendarLoadRange {
  // Include date-only all-day values whose storage uses the browser's civil day.
  const startMs = Math.min(
    start.getTime(),
    fromCalendarDate(start, timezone).getTime(),
  )
  const endMs = Math.max(
    end.getTime(),
    fromCalendarDate(end, timezone).getTime(),
  )
  return {
    startDate: new Date(startMs).toISOString(),
    endDate: new Date(endMs).toISOString(),
    timezone,
  }
}

export function eventRangeKey(range: CalendarLoadRange) {
  return `/api/events?${new URLSearchParams({ startDate: range.startDate, endDate: range.endDate, tz: range.timezone })}`
}
export const isEventRangeKey = (key: unknown): key is string =>
  typeof key === 'string' &&
  (key === '/api/events' || key.startsWith('/api/events?'))
