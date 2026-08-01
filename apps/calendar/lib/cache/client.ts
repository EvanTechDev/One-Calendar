import Redis from 'ioredis'

let _redis: Redis | null = null

export function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.REDIS_URL
    if (!url) {
      throw new Error('REDIS_URL is not set — falling back to PG')
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
      // fail open — don't crash the app, just fall back to PG
    })
  }
  return _redis
}

export async function withRedis<T>(
  fn: (redis: Redis) => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  try {
    const redis = getRedis()
    return await fn(redis)
  } catch {
    return fallback()
  }
}
