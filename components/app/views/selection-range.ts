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
