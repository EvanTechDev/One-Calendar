import { getMcpSettings } from './settings'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 60_000)

export async function checkRateLimit(userId: string): Promise<{
  allowed: boolean
  remaining: number
  resetAt: number
}> {
  const settings = await getMcpSettings(userId)
  const maxRpm = settings.rateLimitRpm

  const now = Date.now()
  const windowKey = `${userId}:${Math.floor(now / 60_000)}`

  const entry = store.get(windowKey)

  if (!entry || entry.resetAt < now) {
    store.set(windowKey, {
      count: 1,
      resetAt: now + 60_000,
    })
    return { allowed: true, remaining: maxRpm - 1, resetAt: now + 60_000 }
  }

  if (entry.count >= maxRpm) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return {
    allowed: true,
    remaining: maxRpm - entry.count,
    resetAt: entry.resetAt,
  }
}
