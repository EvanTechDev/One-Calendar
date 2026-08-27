// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatDeployAge } from '@/lib/deploy-age'

/**
 * How long ago this build was deployed.
 *
 * Meet showed an absolute timestamp ("26 Aug 2026, 21:45") while the calendar
 * showed a relative age ("3 hours ago"). Two apps reporting the same fact in two
 * formats is the divergence ADR 0022 is about, in the one card whose whole purpose
 * is telling you which build you are looking at.
 *
 * The thresholds match the calendar's `formatTimeAgo` exactly: minutes under an
 * hour, hours under a day, days above.
 */
const NOW = new Date('2026-08-27T12:00:00Z').getTime()

afterEach(() => vi.useRealTimers())

const at = (iso: string) => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  return formatDeployAge(iso)
}

describe('formatDeployAge', () => {
  it('reports minutes under an hour', () => {
    expect(at('2026-08-27T11:30:00Z')).toBe('30 minutes ago')
  })

  it('never reports zero minutes', () => {
    // A build deployed seconds ago reads as "1 minute ago", not "0 minutes ago",
    // which looks like a bug rather than a fresh deploy. Matches the calendar's
    // Math.max(1, …).
    expect(at('2026-08-27T11:59:59Z')).toBe('1 minute ago')
    expect(at('2026-08-27T12:00:00Z')).toBe('1 minute ago')
  })

  it('singularises', () => {
    expect(at('2026-08-27T11:00:00Z')).toBe('1 hour ago')
    expect(at('2026-08-26T12:00:00Z')).toBe('1 day ago')
  })

  it('reports hours under a day', () => {
    expect(at('2026-08-27T09:00:00Z')).toBe('3 hours ago')
    expect(at('2026-08-26T13:00:00Z')).toBe('23 hours ago')
  })

  it('reports days above that', () => {
    expect(at('2026-08-25T12:00:00Z')).toBe('2 days ago')
  })

  it('switches at exactly an hour and exactly a day', () => {
    // The boundaries are where a formatter usually disagrees with the one it is
    // meant to match.
    expect(at('2026-08-27T11:01:00Z')).toBe('59 minutes ago')
    expect(at('2026-08-26T12:01:00Z')).toBe('23 hours ago')
  })

  it('returns null for an unset or unparseable value', () => {
    // Null rather than "unknown": the caller omits the row entirely, because an
    // "unknown" row reads as a defect rather than an unset build variable.
    expect(formatDeployAge('')).toBeNull()
    expect(formatDeployAge('not a date')).toBeNull()
  })

  it('does not report a future build as a negative age', () => {
    // Clock skew between the build machine and the browser is normal.
    expect(at('2026-08-27T13:00:00Z')).toBe('1 minute ago')
  })
})
