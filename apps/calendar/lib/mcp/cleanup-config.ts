import crypto from 'crypto'

/**
 * Bounds for a retention window, in days. Shared by the lenient environment
 * parser and the strict query-parameter parser below so the two cannot drift
 * into accepting different ranges.
 */
export const MIN_RETENTION_DAYS = 1
export const MAX_RETENTION_DAYS = 3650

export function clampRetentionDays(n: number): number {
  return Math.min(MAX_RETENTION_DAYS, Math.max(MIN_RETENTION_DAYS, n))
}

/**
 * Retention window from an environment variable, which must never take the app
 * down. Anything unusable falls back to the documented default: a mistyped
 * `MCP_AUDIT_RETENTION_DAYS` degrades to 30 days rather than pruning with a
 * window nobody chose.
 */
export function parseRetentionDays(raw: string | null, fallback = 30): number {
  if (!raw) return fallback
  const n = Number(raw)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return fallback
  return clampRetentionDays(n)
}

/**
 * Retention window from a user-supplied query parameter, which must be either
 * absent or exactly right.
 *
 * Deliberately the opposite of the environment parser: no fallback and no
 * clamping, because someone who typed `?retentionDays=abc` asked a question
 * and must not be handed 30 days as the answer. The cutoffs are the difference
 * between "delete half the audit history" and "delete nothing", so a wrong
 * value gets a 400 rather than a guess.
 *
 * Tri-state, because absent and unusable are different things:
 * `undefined` absent, `null` present but not a usable window, or the days.
 */
export function parseRequestedRetentionDays(
  raw: string | null,
): number | null | undefined {
  if (raw === null) return undefined
  if (raw.trim() === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null
  if (n < MIN_RETENTION_DAYS || n > MAX_RETENTION_DAYS) return null
  return n
}

export function secretMatches(
  provided: string | undefined | null,
  expected: string | undefined | null,
): boolean {
  if (!provided || !expected) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
