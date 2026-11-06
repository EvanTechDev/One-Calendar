import { mock as moduleMock } from 'bun:test'
import { beforeEach, describe, expect, it } from 'bun:test'
import { NextRequest } from 'next/server'
import { getFakeDb } from './route-test-db'

const nativeDrizzle = { ...(await import('drizzle-orm')) }
moduleMock.module('drizzle-orm', async () => ({
  ...nativeDrizzle,
  ...(await import('./route-test-db')).drizzleOperatorsMock,
}))
moduleMock.module('@/lib/drizzle/client', () => ({
  getDb: () => getFakeDb().db,
}))

const viewer = {
  id: 'participant',
  email: 'participant@example.com',
}
moduleMock.module('@/lib/api-helpers', () => ({
  getAuthedUser: async () => viewer,
  decryptEvent: (event: unknown) => event,
}))

const { GET, POST } = await import('@/app/api/bookmarks/route')
const fake = getFakeDb()
const MASTER = 'private-series'
const STAMP = '20260803T090000Z'
const OCCURRENCE_ID = `${MASTER}_${STAMP}`

function seedEvent(id: string, fields: Record<string, unknown> = {}) {
  fake.seed({
    id,
    userId: 'organiser',
    title: 'Master private title',
    description: 'Master private description',
    location: 'Master private location',
    startDate: new Date('2026-08-01T09:00:00Z'),
    endDate: new Date('2026-08-01T10:00:00Z'),
    isAllDay: false,
    status: 'confirmed',
    color: 'bg-blue-500',
    categoryId: 'organiser-private-category',
    participants: [],
    notificationMinutes: 30,
    emailReminder: true,
    rrule: null,
    exdate: null,
    seriesId: null,
    recurrenceId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...fields,
  })
}

function seedSingleOccurrenceGrant(recurrenceId = STAMP, visible = true) {
  fake.seed(
    {
      id: 'invite-single',
      eventId: MASTER,
      email: viewer.email,
      status: 'pending',
      inviteToken: 'token',
      emailSent: true,
      addedToCalendar: true,
      categoryId: null,
      baselineKind: 'none',
      fromStamp: null,
      untilStamp: null,
      expiresAt: null,
    },
    'event_invites',
  )
  fake.seed(
    {
      id: 'grant-single',
      inviteId: 'invite-single',
      recurrenceId,
      visible,
      status: 'accepted',
    },
    'event_invite_occurrences',
  )
}

function seedGrantedSeries() {
  seedEvent(MASTER, {
    rrule: 'FREQ=DAILY;COUNT=5',
    exdate: ['20260802T090000Z'],
  })
  seedEvent('override-granted', {
    title: 'Granted occurrence title',
    description: 'Granted occurrence description',
    location: 'Granted occurrence location',
    startDate: new Date('2026-08-10T12:00:00Z'),
    endDate: new Date('2026-08-10T13:00:00Z'),
    seriesId: MASTER,
    recurrenceId: STAMP,
  })
  fake.seed(
    {
      id: 'organiser',
      name: 'Organiser',
      email: 'organiser@example.com',
      image: null,
    },
    'user',
  )
  seedSingleOccurrenceGrant()
}

async function createBookmark(eventId = OCCURRENCE_ID) {
  return POST(
    new NextRequest('http://localhost/api/bookmarks', {
      method: 'POST',
      body: JSON.stringify({ eventId }),
    }),
  )
}

function seedBookmark(id: string, eventId: string) {
  fake.seed(
    {
      id,
      userId: viewer.id,
      eventId,
      createdAt: new Date('2026-08-01T00:00:00Z'),
    },
    'bookmarked_events',
  )
}

function expectNoSeriesOrRowMetadata(event: Record<string, unknown>) {
  for (const field of [
    'rrule',
    'exdate',
    'seriesStartDate',
    'recurrenceSummary',
    'isFirstInstance',
    'userId',
    'categoryId',
    'notificationMinutes',
    'emailReminder',
    'createdAt',
    'updatedAt',
  ]) {
    expect(event).not.toHaveProperty(field)
  }
}

beforeEach(() => {
  fake.reset()
  viewer.id = 'participant'
  viewer.email = 'participant@example.com'
})

describe('REST bookmark occurrence responses', () => {
  it('returns only the granted occurrence after creating its bookmark', async () => {
    seedGrantedSeries()
    expect((await createBookmark()).status).toBe(200)

    const response = await GET()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const { bookmarks } = await response.json()
    expect(bookmarks).toHaveLength(1)
    const event = bookmarks[0].event
    expect(event).toMatchObject({
      id: OCCURRENCE_ID,
      instanceId: OCCURRENCE_ID,
      seriesId: MASTER,
      recurrenceId: STAMP,
      title: 'Granted occurrence title',
      description: 'Granted occurrence description',
      location: 'Granted occurrence location',
      startDate: '2026-08-10T12:00:00.000Z',
      endDate: '2026-08-10T13:00:00.000Z',
      viewOnly: true,
    })
    expectNoSeriesOrRowMetadata(event)
  })

  it('resolves an owned occurrence without returning its series rule', async () => {
    viewer.id = 'owner'
    viewer.email = 'owner@example.com'
    seedEvent(MASTER, {
      userId: viewer.id,
      rrule: 'FREQ=DAILY;COUNT=5',
      exdate: ['20260802T090000Z'],
    })
    seedEvent('owned-override', {
      userId: viewer.id,
      title: 'Owned occurrence title',
      startDate: new Date('2026-08-10T12:00:00Z'),
      endDate: new Date('2026-08-10T13:00:00Z'),
      seriesId: MASTER,
      recurrenceId: STAMP,
    })
    expect((await createBookmark()).status).toBe(200)

    const response = await GET()
    expect(response.status).toBe(200)
    const { bookmarks } = await response.json()
    expect(bookmarks).toHaveLength(1)
    expect(bookmarks[0].event).toMatchObject({
      id: OCCURRENCE_ID,
      instanceId: OCCURRENCE_ID,
      seriesId: MASTER,
      recurrenceId: STAMP,
      title: 'Owned occurrence title',
      startDate: '2026-08-10T12:00:00.000Z',
      endDate: '2026-08-10T13:00:00.000Z',
      isOverride: true,
    })
    expectNoSeriesOrRowMetadata(bookmarks[0].event)
  })

  it('rejects a bookmark for an occurrence outside the grant', async () => {
    seedGrantedSeries()
    const response = await createBookmark(`${MASTER}_20260804T090000Z`)
    expect(response.status).toBe(403)
    expect(fake.rows('bookmarked_events')).toHaveLength(0)

    const list = await GET()
    expect(list.status).toBe(200)
    expect(await list.json()).toEqual({ bookmarks: [] })
  })

  it('omits a bookmark whose occurrence grant was revoked', async () => {
    seedGrantedSeries()
    expect((await createBookmark()).status).toBe(200)
    seedSingleOccurrenceGrant(STAMP, false)

    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ bookmarks: [] })
  })

  it('omits a revoked recurring-master bookmark without a fallback', async () => {
    seedGrantedSeries()
    const invite = fake.row('invite-single', 'event_invites')!
    fake.seed({ ...invite, addedToCalendar: false }, 'event_invites')
    seedBookmark('revoked-master', MASTER)

    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ bookmarks: [] })
  })

  it('omits a granted id that does not resolve to an occurrence', async () => {
    seedGrantedSeries()
    const eventId = `${MASTER}_20260810T090000Z`
    seedSingleOccurrenceGrant('20260810T090000Z')
    expect((await createBookmark(eventId)).status).toBe(200)

    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ bookmarks: [] })
  })

  it('omits stale bookmarks with missing masters or malformed ids', async () => {
    seedSingleOccurrenceGrant()
    seedBookmark('missing-master', OCCURRENCE_ID)
    seedBookmark('malformed-id', `${MASTER}_not-a-recurrence-stamp`)

    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ bookmarks: [] })
  })
})
