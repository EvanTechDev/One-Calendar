import { withRedis } from './client'
import { eventsMonthKey, affectedMonths, yearMonthFromDate } from './keys'
import { calendarEvents } from '@/lib/drizzle/schema'

const EVENT_CACHE_TTL = 600

export type CachedEvent = typeof calendarEvents.$inferSelect

const DATE_FIELD_KEYS = new Set<string>([
  'startDate',
  'endDate',
  'createdAt',
  'updatedAt',
])

function parseCachedEvents(json: string): CachedEvent[] {
  return JSON.parse(json, (key, value) => {
    if (
      typeof value === 'string' &&
      DATE_FIELD_KEYS.has(key) &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
    ) {
      return new Date(value)
    }
    return value
  }) as CachedEvent[]
}

export async function getCachedEvents(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<CachedEvent[] | null> {
  return withRedis<CachedEvent[] | null>(
    async (redis) => {
      const months = affectedMonths(startDate, endDate)
      const keys = months.map((m) => eventsMonthKey(userId, m))
      const results = await redis.mget(...keys)

      for (let i = 0; i < results.length; i++) {
        if (!results[i]) return null
      }

      const allEvents: CachedEvent[] = []
      for (const result of results) {
        try {
          allEvents.push(...parseCachedEvents(result!))
        } catch {
          return null
        }
      }

      const start = new Date(startDate)
      const end = new Date(endDate)
      return allEvents.filter((e) => e.startDate >= start && e.endDate <= end)
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
      const months = affectedMonths(startDate, endDate)
      const keys = months.map((m) => eventsMonthKey(userId, m))
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    },
    async () => {},
  )
}

export function groupByMonth(
  events: CachedEvent[],
): Map<string, CachedEvent[]> {
  const grouped = new Map<string, CachedEvent[]>()
  for (const event of events) {
    const ym = yearMonthFromDate(event.startDate)
    if (!grouped.has(ym)) grouped.set(ym, [])
    grouped.get(ym)!.push(event)
  }
  return grouped
}
