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
  decryptEvent: (event: unknown) => event,
}))
vi.mock('@/lib/cache/events', async (original) => ({
  ...(await original<typeof import('@/lib/cache/events')>()),
  getCachedEvents: async () => null,
  setCachedEvents: async () => {},
  invalidateEventCache: async () => {},
}))
vi.mock('@zntr/meetings', () => ({
  getMeetingsForEvents: async () => new Map(),
}))

import { GET } from '@/app/api/events/route'
const fake = getFakeDb()
function seed(id: string, start: string, end: string, extra = {}) {
  fake.seed({
    id,
    userId: 'owner',
    title: id,
    startDate: new Date(start),
    endDate: new Date(end),
    isAllDay: false,
    rrule: null,
    exdate: null,
    seriesId: null,
    recurrenceId: null,
    categoryId: null,
    ...extra,
  })
}
function request(query: string) {
  return new NextRequest(`http://localhost/api/events?tz=UTC&${query}`)
}
beforeEach(() => fake.reset())
describe('complete calendar date ranges', () => {
  it('retains recurrence editing metadata when opening an unloaded own search hit', async () => {
    seed('series', '2035-02-04T09:00:00Z', '2035-02-04T10:00:00Z', {
      rrule: 'FREQ=DAILY;COUNT=3',
    })
    const first = await GET(request('id=series_20350204T090000Z'))
    const following = await GET(request('id=series_20350205T090000Z'))
    expect((await first.json()).event).toMatchObject({
      seriesStartDate: '2035-02-04T09:00:00.000Z',
      isFirstInstance: true,
    })
    expect((await following.json()).event).toMatchObject({
      seriesStartDate: '2035-02-04T09:00:00.000Z',
      isFirstInstance: false,
    })
  })
  it('includes events overlapping the requested range, not only contained events', async () => {
    seed('spanning', '2035-01-20T09:00:00Z', '2035-03-03T09:00:00Z')
    const response = await GET(
      request('startDate=2035-02-01&endDate=2035-03-01'),
    )
    expect(
      (await response.json()).events.map((e: { id: string }) => e.id),
    ).toContain('spanning')
  })
  it('loads more than 1000 events in a distant visible month', async () => {
    for (let i = 0; i < 1105; i++)
      seed(`event-${i}`, '2035-02-04T09:00:00Z', '2035-02-04T10:00:00Z')
    const response = await GET(
      request('startDate=2035-02-01&endDate=2035-03-01'),
    )
    expect((await response.json()).events).toHaveLength(1105)
  })
  it('expands shared recurring events inside the requested distant range', async () => {
    seed('shared-series', '2035-02-04T09:00:00Z', '2035-02-04T10:00:00Z', {
      userId: 'other',
      rrule: 'FREQ=DAILY;COUNT=3',
    })
    fake.seed(
      {
        id: 'grant',
        eventId: 'shared-series',
        email: 'owner@example.com',
        addedToCalendar: true,
        baselineKind: 'all',
        fromStamp: null,
        untilStamp: null,
        inviteToken: 'synthetic-test-token',
      },
      'event_invites',
    )
    const response = await GET(
      request('startDate=2035-02-01&endDate=2035-03-01'),
    )
    expect((await response.json()).events).toHaveLength(3)
  })
  it('resolves distant shared search hits through the same occurrence permissions', async () => {
    seed('shared-series', '2035-02-04T09:00:00Z', '2035-02-04T10:00:00Z', {
      userId: 'other',
      rrule: 'FREQ=DAILY;COUNT=3',
    })
    fake.seed(
      {
        id: 'grant',
        eventId: 'shared-series',
        email: 'owner@example.com',
        addedToCalendar: true,
        baselineKind: 'none',
        fromStamp: null,
        untilStamp: null,
        inviteToken: 'synthetic-test-token',
      },
      'event_invites',
    )
    fake.seed(
      {
        id: 'visible',
        inviteId: 'grant',
        recurrenceId: '20350205T090000Z',
        visible: true,
        status: 'pending',
      },
      'event_invite_occurrences',
    )
    const permitted = await GET(request('id=shared-series_20350205T090000Z'))
    expect(permitted.status).toBe(200)
    expect((await permitted.json()).event.viewOnly).toBe(true)
    expect(
      (await GET(request('id=shared-series_20350204T090000Z'))).status,
    ).toBe(404)
  })
})
