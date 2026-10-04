// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const store = vi.hoisted(() => new Map<string, string>())
vi.mock('@/lib/cache/client', () => ({
  withRedis: (run: (redis: unknown) => unknown) =>
    run({
      mget: async (...keys: string[]) =>
        keys.map((key) => store.get(key) ?? null),
      setex: async (key: string, _ttl: number, value: string) =>
        store.set(key, value),
    }),
}))
import {
  getCachedEvents,
  groupByMonth,
  setCachedEvents,
  type CachedEvent,
} from '@/lib/cache/events'
import { fullMonthRange } from '@/lib/cache/keys'
beforeEach(() => store.clear())
it('retains spanning events on a cache hit without duplicate rows or caching partial outer months', async () => {
  const event = {
    id: 'long',
    startDate: new Date('2035-01-20T00:00:00Z'),
    endDate: new Date('2035-04-03T00:00:00Z'),
  } as CachedEvent
  const start = '2035-02-01T00:00:00Z'
  const end = '2035-03-31T23:59:59Z'
  const groups = groupByMonth([event], fullMonthRange(start, end))
  expect([...groups.keys()]).toEqual(['2035-02', '2035-03'])
  for (const [month, rows] of groups)
    await setCachedEvents('owner', month, rows)
  expect(
    (await getCachedEvents('owner', start, end))?.map((row) => row.id),
  ).toEqual(['long'])
  expect(
    await getCachedEvents(
      'owner',
      '2035-01-01T00:00:00Z',
      '2035-01-31T23:59:59Z',
    ),
  ).toBeNull()
  expect(await getCachedEvents('other', start, end)).toBeNull()
})
