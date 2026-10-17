// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getFakeDb } from './route-test-db'

vi.mock('drizzle-orm', async (original) => ({
  ...(await original<typeof import('drizzle-orm')>()),
  ...(await import('./route-test-db')).drizzleOperatorsMock,
}))
vi.mock('@/lib/drizzle/client', () => ({ getDb: () => getFakeDb().db }))
const reads = vi.hoisted(() => ({ decrypt: vi.fn((event: unknown) => event) }))
vi.mock('@/lib/api-helpers', () => ({
  getAuthedUser: async () => ({ id: 'viewer', email: 'viewer@example.com' }),
  decryptEvent: reads.decrypt,
}))
vi.mock('@/lib/field-crypto', () => ({
  encryptField: (_id: string, value: unknown) => value,
  encryptJsonField: (_id: string, value: unknown) => value,
  decryptField: (_id: string, value: unknown) => value,
  decryptFieldStrict: (_id: string, value: unknown) => value,
  looksLikeEnvelope: () => true,
}))
import { GET } from '@/app/api/events/route'

const fake = getFakeDb()
function seed(id: string, fields: Record<string, unknown> = {}) {
  fake.seed({
    id,
    userId: 'viewer',
    title: id,
    description: null,
    location: null,
    startDate: new Date('2026-10-05T09:00:00Z'),
    endDate: new Date('2026-10-05T10:00:00Z'),
    isAllDay: false,
    status: 'confirmed',
    color: null,
    categoryId: 'work',
    participants: null,
    notificationMinutes: null,
    emailReminder: false,
    rrule: null,
    exdate: null,
    seriesId: null,
    recurrenceId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...fields,
  })
}
function grant(eventId: string, fields: Record<string, unknown> = {}) {
  fake.seed(
    {
      id: `invite-${eventId}`,
      eventId,
      email: 'viewer@example.com',
      status: 'declined',
      inviteToken: 'token',
      emailSent: true,
      addedToCalendar: true,
      categoryId: null,
      baselineKind: 'all',
      fromStamp: null,
      untilStamp: null,
      expiresAt: new Date('2020-01-01'),
      ...fields,
    },
    'event_invites',
  )
}
const bounds =
  'startDate=2026-10-05T00:00:00Z&endDate=2026-10-06T00:00:00Z&tz=UTC'
async function list(query = bounds) {
  const response = await GET(
    new NextRequest(`http://localhost/api/events?${query}`),
  )
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  return (await response.json()).events as Array<Record<string, unknown>>
}
beforeEach(() => {
  fake.reset()
  reads.decrypt.mockClear()
})

it('selects exact overlapping dates once and preserves overrides moved into or out of the window', async () => {
  seed('overlap', { startDate: new Date('2026-10-04T23:00:00Z') })
  seed('outside', {
    startDate: new Date('2026-10-20T09:00:00Z'),
    endDate: new Date('2026-10-20T10:00:00Z'),
  })
  seed('private', { userId: 'stranger' })
  seed('series', {
    startDate: new Date('2026-10-01T09:00:00Z'),
    endDate: new Date('2026-10-01T10:00:00Z'),
    rrule: 'FREQ=DAILY;COUNT=10',
  })
  seed('moved-out', {
    seriesId: 'series',
    recurrenceId: '20261005T090000Z',
    startDate: new Date('2026-10-20T09:00:00Z'),
    endDate: new Date('2026-10-20T10:00:00Z'),
  })
  seed('moved-in', { seriesId: 'series', recurrenceId: '20261002T090000Z' })
  seed('overnight', {
    startDate: new Date('2026-10-01T23:00:00Z'),
    endDate: new Date('2026-10-02T01:00:00Z'),
    rrule: 'FREQ=DAILY;COUNT=4',
  })
  seed('moved-overnight', {
    seriesId: 'series',
    recurrenceId: '20261003T090000Z',
    startDate: new Date('2026-10-04T23:30:00Z'),
    endDate: new Date('2026-10-05T00:30:00Z'),
  })
  const events = await list(`${bounds}&categoryIds=work`)
  expect(events.map((event) => event.id).sort()).toEqual([
    'overlap',
    'overnight_20261004T230000Z',
    'series_20261002T090000Z',
    'series_20261003T090000Z',
  ])
  const decryptedIds = reads.decrypt.mock.calls.map(
    ([event]) => (event as { id: string }).id,
  )
  expect(decryptedIds.sort()).toEqual([
    'moved-in',
    'moved-out',
    'moved-overnight',
    'overlap',
    'overnight',
    'series',
  ])
})

it('preserves permanent shared grants, per-occurrence RSVP and rule withholding', async () => {
  seed('shared', { userId: 'organiser', rrule: 'FREQ=DAILY;COUNT=3' })
  grant('shared')
  seed('revoked', { userId: 'organiser' })
  grant('revoked', { addedToCalendar: false })
  fake.seed(
    { id: 'organiser', name: 'Org', email: 'org@example.com', image: null },
    'user',
  )
  fake.seed(
    {
      id: 'rsvp',
      inviteId: 'invite-shared',
      recurrenceId: '20261005T090000Z',
      visible: true,
      status: 'accepted',
    },
    'event_invite_occurrences',
  )
  const events = await list()
  expect(events).toHaveLength(1)
  expect(events[0]).toMatchObject({
    id: 'shared_20261005T090000Z',
    viewOnly: true,
    rrule: null,
    exdate: null,
    invites: [
      expect.objectContaining({ status: 'accepted', inviteToken: 'token' }),
    ],
    meeting: null,
  })
  expect(await list(`${bounds}&categoryIds=other`)).toEqual([])
})

it('reads only the requested shared event and rejects an ungranted id', async () => {
  seed('target', { userId: 'organiser' })
  grant('target')
  seed('unrelated', { userId: 'organiser' })
  grant('unrelated')
  seed('secret', { userId: 'organiser' })
  const response = await GET(
    new NextRequest('http://localhost/api/events?id=target&tz=UTC'),
  )
  expect(response.status).toBe(200)
  expect((await response.json()).event.id).toBe('target')
  expect(
    reads.decrypt.mock.calls.map(([event]) => (event as { id: string }).id),
  ).toEqual(['target'])
  const denied = await GET(
    new NextRequest('http://localhost/api/events?id=secret&tz=UTC'),
  )
  expect(denied.status).toBe(404)
})

it('counts rendered occurrences per side, keeps visible dates complete, and sends only the background delta', async () => {
  seed('daily', {
    startDate: new Date('2024-01-01T09:00:00Z'),
    endDate: new Date('2024-01-01T10:00:00Z'),
    rrule: 'FREQ=DAILY',
  })
  // No private event or ungranted shared event may enter either batch.
  seed('private', { userId: 'stranger' })
  const query = `${bounds}&anchorDate=2026-10-05T12:00:00Z`
  const response = await GET(
    new NextRequest(`http://localhost/api/events?${query}&batchSize=150`),
  )
  const first = await response.json()
  expect(response.status).toBe(200)
  expect(first.events).toHaveLength(300)
  expect(
    first.events.every(
      (event: { seriesId: string }) => event.seriesId === 'daily',
    ),
  ).toBe(true)
  expect(
    first.events.filter(
      (event: { startDate: string }) =>
        Date.parse(event.startDate) < Date.parse('2026-10-05T12:00:00Z'),
    ),
  ).toHaveLength(150)
  expect(first.coverage.startDate <= '2026-10-05T00:00:00.000Z').toBe(true)
  expect(first.coverage.endDate >= '2026-10-06T00:00:00.000Z').toBe(true)
  expect(reads.decrypt).toHaveBeenCalledTimes(1)
  const deltaQuery = new URLSearchParams({
    excludeStartDate: first.coverage.startDate,
    excludeEndDate: first.coverage.endDate,
  })
  const moreResponse = await GET(
    new NextRequest(
      `http://localhost/api/events?${query}&batchSize=400&${deltaQuery}`,
    ),
  )
  const more = await moreResponse.json()
  expect(moreResponse.status).toBe(200)
  expect(more.events).toHaveLength(500)
  expect(new Set(more.retainedIds)).toEqual(
    new Set(first.events.map((event: { id: string }) => event.id)),
  )
  expect(
    new Set([...first.events, ...more.events].map((event) => event.id)).size,
  ).toBe(800)
  expect(
    more.events.every(
      (event: { id: string }) =>
        !first.events.some((old: { id: string }) => old.id === event.id),
    ),
  ).toBe(true)
  // Completeness wins over the target when the requested year has >150/side.
  const year = await GET(
    new NextRequest(
      `http://localhost/api/events?startDate=2026-01-01T00:00:00Z&endDate=2027-01-01T00:00:00Z&tz=UTC&anchorDate=2026-10-05T12:00:00Z&batchSize=150`,
    ),
  )
  const yearly = await year.json()
  expect(
    yearly.events.filter(
      (event: { startDate: string }) =>
        event.startDate >= '2026-01-01' && event.startDate < '2027-01-01',
    ),
  ).toHaveLength(365)
})

it('selects the nearest plain events, includes boundary ties, and rejects invalid batches', async () => {
  const anchor = Date.parse('2026-10-05T12:00:00Z')
  for (let day = -450; day <= 450; day++) {
    const startDate = new Date(anchor + day * 86400000)
    seed(`plain-${day}`, {
      startDate,
      endDate: new Date(startDate.getTime() + 3600000),
    })
  }
  seed('boundary-tie', {
    startDate: new Date(anchor - 150 * 86400000),
    endDate: new Date(anchor - 150 * 86400000 + 3600000),
  })
  const events = await list(
    `${bounds}&anchorDate=2026-10-05T12:00:00Z&batchSize=150`,
  )
  expect(events).toHaveLength(301)
  expect(events.some((event) => event.id === 'plain--150')).toBe(true)
  expect(events.some((event) => event.id === 'boundary-tie')).toBe(true)
  expect(events.some((event) => event.id === 'plain--151')).toBe(false)
  const invalid = await GET(
    new NextRequest(
      `http://localhost/api/events?${bounds}&anchorDate=bad&batchSize=1000000`,
    ),
  )
  expect(invalid.status).toBe(400)
})

it.each([false, true])(
  'loads a 1949 event in the background batch of a small calendar (recurring: %s)',
  async (recurring) => {
    // 199 occurrences this year and one in 1949. The initial past 150 can
    // legitimately omit 1949; the background past 400 must not omit it.
    const yearStart = Date.parse('2026-01-01T09:00:00Z')
    for (let day = 0; day < 199; day++) {
      const startDate = new Date(yearStart + day * 86400000)
      seed(`recent-${day}`, {
        startDate,
        endDate: new Date(startDate.getTime() + 3600000),
        rrule: recurring && day === 0 ? 'FREQ=DAILY;COUNT=1' : null,
      })
    }
    seed('historical', {
      startDate: new Date('1949-10-01T09:00:00Z'),
      endDate: new Date('1949-10-01T10:00:00Z'),
    })
    const query = `${bounds}&anchorDate=2026-10-05T12:00:00Z`
    const firstResponse = await GET(
      new NextRequest(`http://localhost/api/events?${query}&batchSize=150`),
    )
    expect(firstResponse.status).toBe(200)
    const first = await firstResponse.json()
    expect(first.events).toHaveLength(150)
    expect(first.complete).toBe(false)
    const exclude = new URLSearchParams({
      excludeStartDate: first.coverage.startDate,
      excludeEndDate: first.coverage.endDate,
    })
    const response = await GET(
      new NextRequest(
        `http://localhost/api/events?${query}&batchSize=400&${exclude}`,
      ),
    )
    expect(response.status).toBe(200)
    const more = await response.json()
    const retained = new Set(more.retainedIds)
    const events = [
      ...first.events.filter((event: { id: string }) => retained.has(event.id)),
      ...more.events,
    ]
    expect(events).toHaveLength(200)
    expect(events.some((event) => event.id === 'historical')).toBe(true)
    expect(more.coverage.startDate <= '1949-10-01T09:00:00.000Z').toBe(true)
  },
)

it('includes distant series anchors, shared events and moved overrides without a fixed year cutoff', async () => {
  seed('old-series', {
    startDate: new Date('1949-10-01T09:00:00Z'),
    endDate: new Date('1949-10-01T10:00:00Z'),
    rrule: 'FREQ=DAILY;COUNT=1',
  })
  seed('series', { rrule: 'FREQ=DAILY;COUNT=1' })
  seed('moved', {
    seriesId: 'series',
    recurrenceId: '20261005T090000Z',
    startDate: new Date('2100-01-01T09:00:00Z'),
    endDate: new Date('2100-01-01T10:00:00Z'),
  })
  seed('shared-old', {
    userId: 'organiser',
    startDate: new Date('1949-09-01T09:00:00Z'),
    endDate: new Date('1949-09-01T10:00:00Z'),
  })
  grant('shared-old')
  const events = await list(
    `${bounds}&anchorDate=2026-10-05T12:00:00Z&batchSize=150`,
  )
  expect(events.map((event) => event.id).sort()).toEqual([
    'old-series_19491001T090000Z',
    'series_20261005T090000Z',
    'shared-old',
  ])
  expect(
    events.find((event) => event.id === 'series_20261005T090000Z'),
  ).toHaveProperty('startDate', '2100-01-01T09:00:00.000Z')
})
