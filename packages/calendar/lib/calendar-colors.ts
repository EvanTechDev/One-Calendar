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
 *
 * No colour values here, deliberately. The swatch the picker shows is painted
 * from `--cal-color-<value>` in `globals.css` (see `swatchColor()`), the same
 * variable the theme blocks hang `--cal-accent` off. When this module carried
 * its own hexes the two lists drifted and the picker sold a yellow the calendar
 * never drew.
 */
export const CALENDAR_COLOR_OPTIONS = [
  { value: 'black-white', labelKey: 'colorBlackWhite' },
  { value: 'orange', labelKey: 'colorOrange' },
  { value: 'yellow', labelKey: 'colorYellow' },
  { value: 'blue', labelKey: 'colorBlue' },
  { value: 'green', labelKey: 'colorGreen' },
  { value: 'pink', labelKey: 'colorPink' },
  { value: 'purple', labelKey: 'colorPurple' },
] as const

export type CalendarColor = (typeof CALENDAR_COLOR_OPTIONS)[number]['value']

/**
 * The fill for a theme's swatch, as a CSS colour.
 *
 * Resolved by the browser rather than returned as a hex, because the variable
 * is the theme's definition: `--cal-color-yellow` is what the yellow theme
 * block sets `--cal-accent` to, so the dot and the calendar cannot disagree.
 *
 * Every theme has a `--cal-color-*` name, the grey one included. It is tempting
 * to let grey read the live `--cal-accent` instead, on the grounds that the
 * neutral is what the grey theme draws — but `--cal-accent` is by definition
 * whatever theme is *currently selected*, so that made the grey swatch paint
 * the active colour: pick yellow and the grey option turned yellow too. The
 * picker has to show all seven options at once, so every one of them has to
 * name its own colour rather than inherit the selection's.
 */
export function swatchColor(value: CalendarColor): string {
  return `var(--cal-color-${value})`
}

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
