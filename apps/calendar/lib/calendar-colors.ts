/**
 * The theme colours a user can pick, in the order the picker lists them.
 *
 * `labelKey` rather than `label`: this module is plain data with no access to
 * the active language, and a literal English label here is what put
 * "Black & white / Orange / …" in front of every user regardless of their
 * settings. The keys are the same `color*` keys the category palette in the
 * sidebar already uses (`labelKey` there too), so the two pickers cannot
 * disagree about what a colour is called. Six of the seven were already
 * translated; only the grey theme needed a key of its own.
 */
export const CALENDAR_COLOR_OPTIONS = [
  { value: 'black-white', labelKey: 'colorBlackWhite', color: '#737373' },
  { value: 'orange', labelKey: 'colorOrange', color: '#f97316' },
  { value: 'yellow', labelKey: 'colorYellow', color: '#facc15' },
  { value: 'blue', labelKey: 'colorBlue', color: '#3b82f6' },
  { value: 'green', labelKey: 'colorGreen', color: '#22c55e' },
  { value: 'pink', labelKey: 'colorPink', color: '#ec4899' },
  { value: 'purple', labelKey: 'colorPurple', color: '#a855f7' },
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
