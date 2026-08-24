export function formatSelectionRange(
  startMinute: number,
  endMinute: number,
  formatHourMinute: (hour: number, minute: number) => string,
) {
  const normalizedStart = Math.min(startMinute, endMinute)
  const normalizedEnd = Math.max(startMinute, endMinute)
  const startHour = Math.floor(normalizedStart / 60)
  const startMin = normalizedStart % 60
  const endHour = Math.floor(normalizedEnd / 60)
  const endMin = normalizedEnd % 60
  return `${formatHourMinute(startHour, startMin)} - ${formatHourMinute(endHour, endMin)}`
}

/**
 * The default range for a create action that names only a start: 30 minutes,
 * clamped to the start's own day. Creating at 23:40 must not spill into the
 * next day — the blue anchor box (CORE-191) renders on the start day, and on
 * the last visible day of the period the spill-over day does not exist on
 * screen at all.
 */
export function defaultCreateRange(start: Date): { start: Date; end: Date } {
  const end = new Date(start.getTime() + 30 * 60000)
  if (end.getDate() !== start.getDate()) {
    const clamped = new Date(start)
    clamped.setHours(23, 59, 0, 0)
    return { start, end: clamped }
  }
  return { start, end }
}

/**
 * Clips a (possibly multi-day, possibly inverted, possibly invalid) range to
 * one calendar day's wall-clock minutes, for rendering one day column's
 * portion of the selection box.
 *
 * Returns null when the range does not touch the day at all — a range that
 * extends into another week/month simply produces null for the columns it
 * does not reach, so views never render outside their visible period.
 */
export function clampRangeToDay(
  range: { start: Date; end: Date },
  day: Date,
): { startMinute: number; endMinute: number } | null {
  const startMs = range.start.getTime()
  const endMs = range.end.getTime()
  if (isNaN(startMs) || isNaN(endMs) || isNaN(day.getTime())) return null

  // Tolerate inverted input (end before start)
  const start = startMs <= endMs ? range.start : range.end
  const end = startMs <= endMs ? range.end : range.start

  const dayStart = new Date(day)
  dayStart.setHours(0, 0, 0, 0)
  const nextDay = new Date(dayStart)
  nextDay.setDate(nextDay.getDate() + 1)

  const coversDay = end > dayStart && start < nextDay
  // A zero-length range (plain click) still marks its own day.
  const zeroLengthOnDay =
    end.getTime() === start.getTime() && start >= dayStart && start < nextDay
  if (!coversDay && !zeroLengthOnDay) return null

  const startMinute =
    start < dayStart ? 0 : start.getHours() * 60 + start.getMinutes()
  const endMinute =
    end >= nextDay ? 24 * 60 : end.getHours() * 60 + end.getMinutes()

  return { startMinute, endMinute }
}

/**
 * True when the range touches the given calendar day. Grid views (month)
 * use this to highlight every cell the draft range covers.
 */
export function selectionCoversDay(
  range: { start: Date; end: Date },
  day: Date,
): boolean {
  return clampRangeToDay(range, day) !== null
}
