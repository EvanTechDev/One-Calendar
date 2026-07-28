import Redis from 'ioredis'

let _redis: Redis | null = null

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL!, {
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
