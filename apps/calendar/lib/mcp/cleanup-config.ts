import crypto from 'crypto'

export function parseRetentionDays(
  raw: string | null,
  fallback = 30,
): number {
  if (!raw) return fallback
  const n = Number(raw)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return fallback
  return Math.min(3650, Math.max(1, n))
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