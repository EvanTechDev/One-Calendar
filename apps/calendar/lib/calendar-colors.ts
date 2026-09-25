export const CALENDAR_COLOR_OPTIONS = [
  { value: 'black-white', label: 'Black & white', color: '#737373' },
  { value: 'orange', label: 'Orange', color: '#f97316' },
  { value: 'yellow', label: 'Yellow', color: '#eab308' },
  { value: 'blue', label: 'Blue', color: '#3b82f6' },
  { value: 'green', label: 'Green', color: '#22c55e' },
  { value: 'pink', label: 'Pink', color: '#ec4899' },
  { value: 'purple', label: 'Purple', color: '#a855f7' },
] as const

export type CalendarColor = (typeof CALENDAR_COLOR_OPTIONS)[number]['value']

export function normalizeCalendarColor(
  color: string | null | undefined,
): CalendarColor {
  return CALENDAR_COLOR_OPTIONS.some((option) => option.value === color)
    ? (color as CalendarColor)
    : 'black-white'
}

export function applyCalendarColor(color: string | null | undefined): void {
  if (typeof document === 'undefined') return

  const normalized = normalizeCalendarColor(color)
  if (normalized === 'black-white') {
    delete document.documentElement.dataset.calendarColor
  } else {
    document.documentElement.dataset.calendarColor = normalized
  }
}
