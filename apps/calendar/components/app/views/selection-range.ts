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
