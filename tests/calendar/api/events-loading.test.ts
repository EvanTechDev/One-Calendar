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
