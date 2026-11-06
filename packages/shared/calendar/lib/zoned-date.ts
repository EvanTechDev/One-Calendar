/** Calendar wall-clock components, separate from an absolute instant. */

export interface DateParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const formatters = new Map<string, Intl.DateTimeFormat>()
export function partsInTz(date: Date, timeZone: string): DateParts {
  let formatter = formatters.get(timeZone)
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
    formatters.set(timeZone, formatter)
  }
  const result: DateParts = {
    year: 0,
    month: 0,
    day: 0,
    hour: 0,
    minute: 0,
    second: 0,
  }
  for (const part of formatter.formatToParts(date)) {
    switch (part.type) {
      case 'year':
        result.year = Number(part.value)
        break
      case 'month':
        result.month = Number(part.value)
        break
      case 'day':
        result.day = Number(part.value)
        break
      case 'hour':
        result.hour = Number(part.value)
        break
      case 'minute':
        result.minute = Number(part.value)
        break
      case 'second':
        result.second = Number(part.value)
        break
    }
  }
  return result
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

/** The zone's offset at an instant. Throws for an unknown zone. */
export function tzOffsetMs(timeZone: string, utcMs: number): number {
  const p = partsInTz(new Date(utcMs), timeZone)
  return (
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - utcMs
  )
}

export function wallClockToInstant(
  parts: DateParts,
  clock: Pick<DateParts, 'hour' | 'minute' | 'second'>,
  timeZone?: string,
): Date {
  if (!timeZone)
    return new Date(
      parts.year,
      parts.month - 1,
      parts.day,
      clock.hour,
      clock.minute,
      clock.second,
    )
  const naive = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    clock.hour,
    clock.minute,
    clock.second,
  )
  // Compatible DST policy: earlier instant in a fold, forward through a gap.
  const dayMs = 86_400_000
  const offsets = new Set(
    [-dayMs, 0, dayMs].map((delta) => tzOffsetMs(timeZone, naive + delta)),
  )
  const candidates = [...offsets].map((offset) => naive - offset)
  const exact = candidates.filter(
    (instant) => instant + tzOffsetMs(timeZone, instant) === naive,
  )
  return new Date(exact.length ? Math.min(...exact) : Math.max(...candidates))
}

/**
 * A civil-date carrier for date-fns/the grid's local getters. This is a display
 * coordinate, NOT an instant: never serialize it or apply timezone formatting
 * again. Keep the original event for callbacks and persistence.
 */
export function toCalendarDate(instant: Date, timeZone: string): Date {
  const p = partsInTz(instant, timeZone)
  return new Date(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
    instant.getMilliseconds(),
  )
}

/** Convert a grid/datepicker wall-clock coordinate back to a real instant. */
export function fromCalendarDate(date: Date, timeZone: string): Date {
  const p = partsInLocal(date)
  const instant = wallClockToInstant(p, p, timeZone)
  return new Date(instant.getTime() + date.getMilliseconds())
}
