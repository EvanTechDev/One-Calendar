/**
 * Pure scheduling math for the agent's find_free_time tool.
 *
 * Deliberately free of Date-library and timezone dependencies: callers hand
 * in busy intervals and a window as epoch milliseconds, and get gaps back.
 * Timezone resolution happens in the toolkit (which knows the user's
 * settings), not here — that keeps this testable with plain numbers.
 */

export interface BusyInterval {
  startMs: number
  endMs: number
}

export interface FreeSlot {
  startMs: number
  endMs: number
  durationMinutes: number
}

export interface FindFreeSlotsOptions {
  windowStartMs: number
  windowEndMs: number
  busy: BusyInterval[]
  /** Minimum useful gap; anything shorter is noise, not free time. */
  minDurationMinutes: number
  /**
   * Clamp candidate slots to these wall-clock hours (0-24, in the user's
   * timezone — the caller pre-shifts the window so hour arithmetic here can
   * stay in UTC). Omit for the whole day.
   */
  dayStartHourUtc?: number
  dayEndHourUtc?: number
  /** Stop after this many slots. */
  maxSlots?: number
}

const MS_PER_MINUTE = 60_000
const MS_PER_DAY = 86_400_000

/** Merge overlapping/adjacent busy intervals into a sorted disjoint list. */
export function mergeBusyIntervals(busy: BusyInterval[]): BusyInterval[] {
  const sorted = busy
    .filter((b) => b.endMs > b.startMs)
    .slice()
    .sort((a, b) => a.startMs - b.startMs)
  const merged: BusyInterval[] = []
  for (const interval of sorted) {
    const last = merged[merged.length - 1]
    if (last && interval.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, interval.endMs)
    } else {
      merged.push({ ...interval })
    }
  }
  return merged
}

/**
 * Gaps between busy intervals inside the window, optionally clamped to
 * working hours, at least minDurationMinutes long.
 */
export function findFreeSlots(options: FindFreeSlotsOptions): FreeSlot[] {
  const {
    windowStartMs,
    windowEndMs,
    minDurationMinutes,
    dayStartHourUtc,
    dayEndHourUtc,
    maxSlots = 20,
  } = options
  if (windowEndMs <= windowStartMs) return []

  const busy = mergeBusyIntervals(options.busy)
  const minMs = minDurationMinutes * MS_PER_MINUTE

  // Raw gaps between busy intervals.
  const gaps: BusyInterval[] = []
  let cursor = windowStartMs
  for (const interval of busy) {
    if (interval.endMs <= windowStartMs) continue
    if (interval.startMs >= windowEndMs) break
    if (interval.startMs > cursor) {
      gaps.push({
        startMs: cursor,
        endMs: Math.min(interval.startMs, windowEndMs),
      })
    }
    cursor = Math.max(cursor, interval.endMs)
  }
  if (cursor < windowEndMs) {
    gaps.push({ startMs: cursor, endMs: windowEndMs })
  }

  // Clamp each gap to daily working hours, splitting multi-day gaps.
  const clamped =
    dayStartHourUtc === undefined && dayEndHourUtc === undefined
      ? gaps
      : clampToDailyHours(gaps, dayStartHourUtc ?? 0, dayEndHourUtc ?? 24)

  const slots: FreeSlot[] = []
  for (const gap of clamped) {
    const duration = gap.endMs - gap.startMs
    if (duration >= minMs) {
      slots.push({
        startMs: gap.startMs,
        endMs: gap.endMs,
        durationMinutes: Math.floor(duration / MS_PER_MINUTE),
      })
      if (slots.length >= maxSlots) break
    }
  }
  return slots
}

function clampToDailyHours(
  gaps: BusyInterval[],
  startHour: number,
  endHour: number,
): BusyInterval[] {
  const out: BusyInterval[] = []
  for (const gap of gaps) {
    // Walk day by day across the gap.
    let dayStart = Math.floor(gap.startMs / MS_PER_DAY) * MS_PER_DAY
    while (dayStart < gap.endMs) {
      const windowStart = dayStart + startHour * 3_600_000
      const windowEnd = dayStart + endHour * 3_600_000
      const start = Math.max(gap.startMs, windowStart)
      const end = Math.min(gap.endMs, windowEnd)
      if (end > start) out.push({ startMs: start, endMs: end })
      dayStart += MS_PER_DAY
    }
  }
  return out
}

/**
 * Offset (ms) to ADD to a UTC epoch so that hour arithmetic in
 * {@link findFreeSlots} happens in the given IANA timezone. The caller
 * shifts inputs by this, runs the pure math, and shifts results back.
 *
 * DST caveat: the offset is sampled at `at` and applied to the whole
 * window. A window that crosses a DST transition can be up to an hour off
 * at the far end — acceptable for suggesting meeting slots, documented so
 * nobody mistakes this for civil-time math.
 */
export function timezoneOffsetMs(at: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = dtf.formatToParts(at)
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  )
  return asUtc - at.getTime()
}
