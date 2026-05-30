export const THEME_STORAGE_KEY = 'theme'
export const AVAILABLE_THEMES = ['light', 'dark'] as const
export const THEME_OPTIONS = [...AVAILABLE_THEMES, 'system'] as const

export type AvailableTheme = (typeof AVAILABLE_THEMES)[number]
export type ThemeOption = (typeof THEME_OPTIONS)[number]

export function normalizeTheme(theme: unknown): ThemeOption | undefined {
  if (THEME_OPTIONS.includes(theme as ThemeOption)) {
    return theme as ThemeOption
  }

  return theme === undefined || theme === null || theme === ''
    ? undefined
    : 'system'
}
