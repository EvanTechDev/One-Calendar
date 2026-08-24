import Redis from 'ioredis'

let _redis: Redis | null = null

function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.REDIS_URL
    if (!url) {
      throw new Error('REDIS_URL is not set')
    }
    _redis = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 2,
      retryStrategy(times) {
        if (times > 3) return null
        return Math.min(times * 200, 2000)
      },
    })
    _redis.on('error', () => {
      // Fail open — a rate limiter that takes the app down with it is worse
      // than no rate limiter. Mirrors apps/calendar/lib/cache/client.ts.
    })
  }
  return _redis
}

export interface RateLimitResult {
  allowed: boolean
  /** Seconds until the current window resets — for the Retry-After header. */
  retryAfter: number
}

/**
 * Fixed-window counter, one Redis key per (name, subject, window).
 *
 * Fails OPEN: without Redis the request is allowed. This is a brake on
 * casual abuse and runaway clients, not a security guarantee. Mirrors
 * apps/calendar/lib/rate-limit.ts so both apps behave the same way.
 *
 * A fixed window permits up to 2x the limit across a window boundary,
 * accepted here for the same reason as in the calendar: a sliding window
 * costs more round trips than these endpoints justify.
 */
export async function checkFixedWindowLimit(options: {
  name: string
  subject: string
  limit: number
  windowSeconds: number
}): Promise<RateLimitResult> {
  const { name, subject, limit, windowSeconds } = options
  const nowSeconds = Math.floor(Date.now() / 1000)
  const bucket = Math.floor(nowSeconds / windowSeconds)
  const key = `rl:${name}:${subject}:${bucket}`
  const retryAfter = (bucket + 1) * windowSeconds - nowSeconds

  try {
    const redis = getRedis()
    const count = await redis.incr(key)
    if (count === 1) {
      // Two windows of slack so a late reader still sees the count.
      await redis.expire(key, windowSeconds * 2)
    }
    return { allowed: count <= limit, retryAfter }
  } catch {
    return { allowed: true, retryAfter: 0 }
  }
}

/** Best-effort client address for rate-limit subjects. */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}
