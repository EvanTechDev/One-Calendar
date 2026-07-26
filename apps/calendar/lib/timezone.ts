const FALLBACK_TIMEZONE = 'UTC'

export function getValidTimezone(timezone: string): string {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone })
    return timezone
  } catch {
    return FALLBACK_TIMEZONE
  }
}
