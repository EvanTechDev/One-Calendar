import { withRedis } from '@/lib/cache/client'

export interface RateLimitResult {
  allowed: boolean
  /** Seconds until the current window resets — for the Retry-After header. */
  retryAfter: number
}

/**
 * Whether the absence of Redis has already been reported.
 *
 * Without `REDIS_URL` every limit below silently allows everything, which is the
 * intended posture but must not be invisible: a production deployment that lost
 * the variable looks identical to one that never had abuse traffic. Logged once
 * rather than per request, so it is findable without drowning the log.
 */
let missingRedisReported = false

function reportMissingRedisOnce() {
  if (missingRedisReported) return
  missingRedisReported = true
  if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL) {
    console.warn(
      '[rate-limit] REDIS_URL is not set in production: every rate limit is ' +
        'allowing all requests. Invites, user lookup, meeting tokens and chat ' +
        'retention are unthrottled.',
    )
  }
}

/**
 * Fixed-window counter, one Redis key per (name, subject, window).
 *
 * Fails OPEN: if Redis is unavailable the request is allowed, matching the
 * posture of the rest of the cache layer (see lib/cache/client.ts). This is a
 * brake on casual abuse and runaway clients, not a security guarantee.
 *
 * A fixed window permits up to 2x the limit across a window boundary. That is
 * accepted here: the alternative (sliding window) costs more round trips than
 * these endpoints justify.
 */
export async function checkFixedWindowLimit(options: {
  name: string
  subject: string
  limit: number
  windowSeconds: number
}): Promise<RateLimitResult> {
  const { name, subject, limit, windowSeconds } = options
  reportMissingRedisOnce()
  const nowSeconds = Math.floor(Date.now() / 1000)
  const bucket = Math.floor(nowSeconds / windowSeconds)
  const key = `rl:${name}:${subject}:${bucket}`
  const retryAfter = (bucket + 1) * windowSeconds - nowSeconds

  return withRedis<RateLimitResult>(
    async (redis) => {
      const count = await redis.incr(key)
      if (count === 1) {
        // Two windows of slack so a late reader still sees the count.
        await redis.expire(key, windowSeconds * 2)
      }
      return { allowed: count <= limit, retryAfter }
    },
    async () => ({ allowed: true, retryAfter }),
  )
}

/**
 * Best-effort client IP. Values are attacker-controllable behind a proxy that
 * does not normalise them, so IP-keyed limits are a speed bump only — never use
 * one where a per-user limit is possible.
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
