import { checkFixedWindowLimit as countAgainst } from '@zntr/auth/rate-limit'
import { getDb } from './drizzle'

export type { RateLimitResult } from '@zntr/auth/rate-limit'

/**
 * Fixed-window counter, one row per (name, subject, window), bound to this app's
 * database handle.
 *
 * This counts in Postgres rather than Redis. It used to fail OPEN when Redis
 * was unreachable — and the configured instance's TLS port timed out, so the
 * limiter was silently inert in production, while every attempt to use it cost
 * ioredis' full 10s connect timeout before falling through. One shared
 * implementation in `@zntr/auth` now backs both apps' limits.
 *
 * Unlike the Redis version this does NOT fail open: if the database is
 * unreachable so is the endpoint's own data, so the request was going to fail
 * anyway, and letting the attempt through would only spend the budget that the
 * outage is about to consume.
 */
export function checkFixedWindowLimit(options: {
  name: string
  subject: string
  limit: number
  windowSeconds: number
}) {
  return countAgainst(getDb(), options)
}

/** Best-effort client address for rate-limit subjects. */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}
