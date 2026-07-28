import { withRedis } from './client'
import { eventsMonthKey } from './keys'
import { calendarEvents } from '@/lib/drizzle/schema'

const EVENT_CACHE_TTL = 600

function computeMonthKeys(
  userId: string,
  startDate: string,
  endDate: string,
): string[] {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const months = new Set<string>()

  const cursor = new Date(start)
  while (cursor <= end) {
    const ym = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`
    months.add(ym)
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }

  return Array.from(months).map((ym) => eventsMonthKey(userId, ym))
}

export type CachedEvent = typeof calendarEvents.$inferSelect

export async function getCachedEvents(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<CachedEvent[] | null> {
  return withRedis<CachedEvent[] | null>(
    async (redis) => {
      const keys = computeMonthKeys(userId, startDate, endDate)
      const results = await redis.mget(...keys)
      const misses: string[] = []
      const allEvents: CachedEvent[] = []

      for (let i = 0; i < results.length; i++) {
        if (results[i]) {
          try {
            const parsed: CachedEvent[] = JSON.parse(
              results[i]!,
              (_key, value) => {
                if (
                  typeof value === 'string' &&
                  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
                ) {
                  return new Date(value)
                }
                return value
              },
            )
            allEvents.push(...parsed)
          } catch {
            misses.push(keys[i])
          }
        } else {
          misses.push(keys[i])
        }
      }

      if (misses.length > 0) return null

      return allEvents.filter((e) => {
        const start = new Date(startDate)
        const end = new Date(endDate)
        return e.startDate >= start && e.endDate <= end
      })
    },
    async () => null,
  )
}

export async function setCachedEvents(
  userId: string,
  yearMonth: string,
  events: CachedEvent[],
): Promise<void> {
  await withRedis<void>(
    async (redis) => {
      await redis.setex(
        eventsMonthKey(userId, yearMonth),
        EVENT_CACHE_TTL,
        JSON.stringify(events),
      )
    },
    async () => {},
  )
}

export async function invalidateEventCache(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<void> {
  await withRedis<void>(
    async (redis) => {
      const keys = computeMonthKeys(userId, startDate, endDate)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    },
    async () => {},
  )
}
