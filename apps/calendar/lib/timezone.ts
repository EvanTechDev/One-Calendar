const FALLBACK_TIMEZONE = 'UTC'

/**
 * Whether `timeZone` is an IANA zone `Intl` accepts.
 *
 * The single timezone validity check in the app. Three copies existed — this
 * one, a private `isTzValid` in the events route, and an inline `Intl`
 * construction in the MCP tools — and they only differed in which locale they
 * passed, which cannot change the answer.
 */
export function isValidTimezone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone })
    return true
  } catch {
    return false
  }
}

/** `timeZone` if `Intl` accepts it, otherwise UTC. */
export function getValidTimezone(timezone: string): string {
  return isValidTimezone(timezone) ? timezone : FALLBACK_TIMEZONE
}
