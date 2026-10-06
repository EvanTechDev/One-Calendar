// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
afterEach(() => vi.useRealTimers())
describe('desktop reminder feed', () => {
  it('uses the server reminder horizon instead of the visible calendar or category', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2035-02-04T09:00:00Z'))
    seed('week-ahead', '2035-02-11T09:00:00Z', '2035-02-11T10:00:00Z', {
      notificationMinutes: 10080,
    })
    seed('disabled', '2035-02-04T09:10:00Z', '2035-02-04T10:00:00Z', {
      notificationMinutes: null,
    })
    seed('expired', '2035-02-04T08:50:00Z', '2035-02-04T10:00:00Z', {
      notificationMinutes: 0,
    })
    seed('not-yet-due', '2035-02-05T09:00:00Z', '2035-02-05T10:00:00Z', {
      notificationMinutes: 5,
    })
    const response = await GET(
      request(
        'delivery=desktop-reminders&startDate=1990-01-01&categoryId=hidden',
      ),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect((await response.json()).reminders).toEqual([
      expect.objectContaining({ title: 'week-ahead', dueAt: Date.now() }),
    ])
  })
  it('uses expanded recurrence identities and keeps the five-minute catch-up window', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2035-02-05T09:03:00Z'))
    seed('daily', '2035-02-04T09:00:00Z', '2035-02-04T10:00:00Z', {
      rrule: 'FREQ=DAILY;COUNT=3',
      notificationMinutes: 0,
    })
    const response = await GET(request('delivery=desktop-reminders'))
    const { reminders } = await response.json()
    expect(reminders).toHaveLength(1)
    expect(reminders[0]).toMatchObject({
      key: `daily_20350205T090000Z-${Date.parse('2035-02-05T09:00:00Z')}`,
      deadline: Date.parse('2035-02-05T09:05:00Z'),
    })
  })
})
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
  it.each(['2035-03-01', '2039-03-01'])(
    'loads more than 1000 events in a range ending %s',
    async (end) => {
      for (let i = 0; i < 1105; i++)
        seed(`event-${i}`, '2035-02-04T09:00:00Z', '2035-02-04T10:00:00Z')
      const response = await GET(request(`startDate=2035-02-01&endDate=${end}`))
      expect(response.status).toBe(200)
      expect((await response.json()).events).toHaveLength(1105)
    },
  )
  it.each([
    'startDate=2035-01-01',
    'startDate=invalid&endDate=2039-01-01',
    'startDate=2039-01-01&endDate=2035-01-01',
    'startDate=2035-01-01&endDate=2040-01-01',
  ])('still rejects invalid or excessive date ranges: %s', async (query) => {
    expect((await GET(request(query))).status).toBe(400)
  })
  it.each(['own', 'shared'])(
    'loads every daily occurrence over four years for an %s series',
    async (kind) => {
      seed('daily', '2035-01-01T09:00:00Z', '2035-01-01T10:00:00Z', {
        userId: kind === 'own' ? 'owner' : 'other',
        rrule: 'FREQ=DAILY',
      })
      if (kind === 'shared')
        fake.seed(
          {
            id: 'grant',
            eventId: 'daily',
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
        request('startDate=2035-01-01&endDate=2039-01-01'),
      )
      expect(response.status).toBe(200)
      const { events } = await response.json()
      expect(events).toHaveLength(1461)
      expect(
        new Set(events.map((event: { id: string }) => event.id)).size,
      ).toBe(1461)
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'daily_20350101T090000Z' }),
          expect.objectContaining({ id: 'daily_20381231T090000Z' }),
        ]),
      )
      if (kind === 'shared')
        expect(
          events.every(
            (event: { rrule: unknown; viewOnly: boolean }) =>
              event.rrule === null && event.viewOnly,
          ),
        ).toBe(true)
    },
  )
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
