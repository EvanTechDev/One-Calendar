import { fromCalendarDate } from './zoned-date'

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
