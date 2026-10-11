import { getDb } from '@/lib/drizzle/client'
import {
  checkFixedWindowLimit as countAgainst,
  cleanupRateLimitCounters as dropClosedCounters,
} from '@zntr/auth/rate-limit'

export type { RateLimitResult } from '@zntr/auth/rate-limit'

/**
 * The shared fixed-window counter, bound to this app's database handle so a
 * call site reads `checkFixedWindowLimit({ ... })`. The implementation and the
 * table it counts live in `@zntr/auth` because the meet app limits against the
 * same rows and the two apps cannot import each other.
 */
export function checkFixedWindowLimit(options: {
  name: string
  subject: string
  limit: number
  windowSeconds: number
}) {
  return countAgainst(getDb(), options)
}

/** Drops counters whose window has closed. Run from the maintenance cron. */
export function cleanupRateLimitCounters() {
  return dropClosedCounters(getDb())
}

/**
 * Best-effort client IP.
 *
 * Values are attacker-controllable behind a proxy that does not normalise
 * them, so IP-keyed limits are a speed bump only — never use one where a
 * per-user limit is possible.
 */
export function clientIpFrom(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

/** Standard 429 body + Retry-After header. */
export function rateLimitedResponse(retryAfter: number): Response {
  return Response.json(
    { error: 'Too many requests', retryAfter },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  )
}
