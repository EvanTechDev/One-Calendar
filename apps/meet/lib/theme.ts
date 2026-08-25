/**
 * Meet's theme vocabulary, kept byte-identical to the calendar's
 * (apps/calendar/lib/theme.ts) on purpose.
 *
 * Both apps use next-themes with its default `theme` localStorage key, so a
 * user who sets light on the calendar and opens meet on the same registered
 * domain... does NOT carry the choice over: localStorage is per-origin, and the
 * two apps are separate subdomains. The vocabulary matches anyway so the two
 * settings dialogs offer the same three options with the same names, and a
 * future server-side settings sync has one shape to sync.
 *
 * Not imported from the calendar — apps never import each other (ADR 0017's
 * structure rule). A three-string list is well under the bar for a package.
 */

export const AVAILABLE_THEMES = ['light', 'dark'] as const
export const THEME_OPTIONS = [...AVAILABLE_THEMES, 'system'] as const

export type AvailableTheme = (typeof AVAILABLE_THEMES)[number]
export type ThemeOption = (typeof THEME_OPTIONS)[number]

export function isThemeOption(value: unknown): value is ThemeOption {
  return THEME_OPTIONS.includes(value as ThemeOption)
}
