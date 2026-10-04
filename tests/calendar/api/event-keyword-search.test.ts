// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getFakeDb } from './route-test-db'
vi.mock('drizzle-orm', async (original) => ({
  ...(await original<typeof import('drizzle-orm')>()),
  ...(await import('./route-test-db')).drizzleOperatorsMock,
}))
vi.mock('@/lib/drizzle/client', () => ({ getDb: () => getFakeDb().db }))
vi.mock('@/lib/api-helpers', () => ({
  getAuthedUser: async () => ({ id: 'owner', email: 'owner@example.com' }),
  decryptEvent: vi.fn((row) => row),
}))
import { GET } from '@/app/api/events/search/route'
import { decryptEvent } from '@/lib/api-helpers'
const fake = getFakeDb()
const seed = (id: string, extra = {}) =>
  fake.seed({
    id,
    userId: 'owner',
    title: 'ordinary',
    description: null,
    location: null,
    startDate: new Date('2035-02-04T09:00Z'),
    endDate: new Date('2035-02-04T10:00Z'),
    isAllDay: false,
    rrule: null,
    exdate: null,
    seriesId: null,
    recurrenceId: null,
    categoryId: null,
    color: null,
    ...extra,
  })
const page = async (
  q: string,
  cursor: string | null = null,
  category?: string,
) => {
  const params = new URLSearchParams({ q })
  if (cursor) params.set('cursor', cursor)
  if (category) params.set('category', category)
  const response = await GET(
    new NextRequest(`http://localhost/api/events/search?${params}`),
  )
  expect(response.status).toBe(200)
  return response.json() as Promise<{
    results: { id: string }[]
    cursor: string | null
  }>
}
beforeEach(() => {
  fake.reset()
  vi.clearAllMocks()
})
describe('server keyword search across unloaded history', () => {
  it('scans beyond 1000 rows in bounded pages, in stable order, without decrypting other accounts', async () => {
    for (let i = 1205; i >= 0; i--)
      seed(`event-${String(i).padStart(4, '0')}`, {
        title: i === 1205 ? 'Needle' : 'ordinary',
      })
    seed('foreign', { userId: 'someone-else', title: 'Needle' })
    let cursor: string | null = null
    const ids: string[] = []
    let pages = 0
    do {
      const before = vi.mocked(decryptEvent).mock.calls.length
      const result = await page('needle', cursor)
      expect(
        vi.mocked(decryptEvent).mock.calls.length - before,
      ).toBeLessThanOrEqual(200)
      ids.push(...result.results.map((e) => e.id))
      cursor = result.cursor
      pages++
    } while (cursor && pages < 20)
    expect(pages).toBe(7)
    expect(ids).toEqual(['event-1205'])
    expect(vi.mocked(decryptEvent)).toHaveBeenCalledTimes(1206)
  })
  it('pages matches without duplicates or dropped rows and honors category filters', async () => {
    for (let i = 74; i >= 0; i--)
      seed(`row-${String(i).padStart(3, '0')}`, {
        title: 'Match',
        categoryId: 'work',
      })
    seed('excluded', { title: 'Match', categoryId: 'home' })
    const a = await page('match', null, 'work')
    const b = await page('match', a.cursor, 'work')
    const c = await page('match', b.cursor, 'work')
    expect([a.results.length, b.results.length, c.results.length]).toEqual([
      30, 30, 15,
    ])
    expect(c.cursor).toBeNull()
    expect(
      new Set([...a.results, ...b.results, ...c.results].map((e) => e.id)).size,
    ).toBe(75)
  })
  it('returns one representative of a series and only a granted shared occurrence', async () => {
    seed('mine', { title: 'Match', rrule: 'FREQ=DAILY;COUNT=3' })
    seed('shared', {
      userId: 'other',
      title: 'Match',
      rrule: 'FREQ=DAILY;COUNT=3',
    })
    fake.seed(
      {
        id: 'grant',
        eventId: 'shared',
        email: 'owner@example.com',
        addedToCalendar: true,
        baselineKind: 'none',
        fromStamp: null,
        untilStamp: null,
        categoryId: null,
      },
      'event_invites',
    )
    fake.seed(
      {
        id: 'exception',
        inviteId: 'grant',
        recurrenceId: '20350205T090000Z',
        visible: true,
        status: 'pending',
      },
      'event_invite_occurrences',
    )
    expect((await page('match')).results.map((e) => e.id)).toEqual([
      'mine_20350204T090000Z',
      'shared_20350205T090000Z',
    ])
  })
})
