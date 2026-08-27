/**
 * How long ago this build was deployed, phrased as the calendar phrases it.
 *
 * Meet showed an absolute timestamp while the calendar showed a relative age. Two
 * apps reporting one fact in two formats is exactly the divergence ADR 0022 is
 * about — and it landed in the card whose only job is telling you which build you
 * are looking at.
 *
 * The thresholds mirror `apps/calendar/components/app/analytics/build-info-card`'s
 * `formatTimeAgo`: minutes below an hour, hours below a day, days above.
 *
 * Not in `@zntr/auth`: this is a build fact, not an auth one. It stays a copy
 * because the calendar's version reads translated strings from `@zntr/i18n` and
 * meet has no language picker — sharing it would mean giving meet an i18n surface
 * to satisfy a five-line formatter.
 */
export function formatDeployAge(buildTime: string): string | null {
  if (!buildTime) return null

  const deployed = new Date(buildTime)
  if (Number.isNaN(deployed.getTime())) return null

  const diffMs = Date.now() - deployed.getTime()
  // Clamped at one minute, as the calendar does: a build deployed seconds ago
  // reading "0 minutes ago" looks like a defect, and clock skew between the build
  // machine and the browser would otherwise produce a negative age.
  const minutes = Math.max(1, Math.floor(diffMs / 60000))

  if (minutes < 60) return `${minutes} ${plural(minutes, 'minute')} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${plural(hours, 'hour')} ago`

  const days = Math.floor(hours / 24)
  return `${days} ${plural(days, 'day')} ago`
}

const plural = (n: number, unit: string) => (n === 1 ? unit : `${unit}s`)
