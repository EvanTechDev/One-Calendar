import { mock as moduleMock } from 'bun:test'
import { beforeEach, describe, expect, it } from 'bun:test'
import { getFakeDb, drizzleOperatorsMock } from './route-test-db'

const OWNER = 'owner'
const STRANGER = 'stranger'
const fake = getFakeDb()

const originalDrizzle = { ...(await import('drizzle-orm')) }
moduleMock.module('drizzle-orm', async () => ({
  ...originalDrizzle,
  ...drizzleOperatorsMock,
}))
moduleMock.module('@/lib/drizzle/client', () => ({
  getDb: () => fake.db,
}))
moduleMock.module('@/lib/api-helpers', () => ({
  getAuthedUser: async () => ({ id: OWNER, email: 'owner@example.com' }),
}))
moduleMock.module('@/lib/field-crypto', () => ({
  encryptField: (_id: string, value: unknown) => value,
  encryptJsonField: (_id: string, value: unknown) => value,
}))
moduleMock.module('@/lib/bookmarks', () => ({
  isEventViewableBy: async () => false,
}))

const { POST } = await import('@/app/api/import/route')

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: 'imported',
    title: 'Imported event',
    startDate: '2026-11-07T09:00:00Z',
    endDate: '2026-11-07T10:00:00Z',
    ...overrides,
  }
}

function request(events: unknown[]) {
  return { json: async () => ({ events }) } as never
}

function seedMaster(id: string, userId: string, rrule: string | null) {
  fake.seed({
    id,
    userId,
    title: id,
    startDate: new Date('2026-11-01T09:00:00Z'),
    endDate: new Date('2026-11-01T10:00:00Z'),
    rrule,
    seriesId: null,
    recurrenceId: null,
  })
}

beforeEach(() => {
  fake.reset()
  seedMaster('victim-master', STRANGER, 'FREQ=DAILY;COUNT=3')
  seedMaster('own-master', OWNER, 'FREQ=DAILY;COUNT=3')
  seedMaster('own-plain', OWNER, null)
  fake.seed({
    id: 'own-override',
    userId: OWNER,
    seriesId: 'own-master',
    recurrenceId: '20261101T090000Z',
    rrule: null,
  })
})

describe('import event ownership', () => {
  it.each([
    ['a foreign master', { seriesId: 'victim-master' }],
    ['a missing recurrence stamp', { seriesId: 'own-master' }],
    ['a null recurrence stamp', { seriesId: 'own-master', recurrenceId: null }],
    [
      'a non-recurring master',
      {
        seriesId: 'own-plain',
        recurrenceId: '20261101T090000Z',
      },
    ],
    [
      'another override as the master',
      {
        seriesId: 'own-override',
        recurrenceId: '20261101T090000Z',
      },
    ],
  ])('rejects %s', async (_name, override) => {
    const response = await POST(request([event(override)]))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      imported: { events: 0 },
      skippedEvents: 1,
    })
    expect(fake.row('imported')).toBeUndefined()
  })

  it('restores an override of the caller’s recurring master', async () => {
    const response = await POST(
      request([
        event({
          seriesId: 'own-master',
          recurrenceId: '20261102T090000Z',
        }),
      ]),
    )
    expect(await response.json()).toMatchObject({
      imported: { events: 1 },
      skippedEvents: 0,
    })
    expect(fake.row('imported')).toMatchObject({
      userId: OWNER,
      seriesId: 'own-master',
      recurrenceId: '20261102T090000Z',
    })
  })

  it('applies the same master check to conflict updates', async () => {
    fake.seed({
      ...event(),
      startDate: new Date('2026-11-07T09:00:00Z'),
      endDate: new Date('2026-11-07T10:00:00Z'),
      userId: OWNER,
      seriesId: null,
      recurrenceId: null,
    })
    const response = await POST(
      request([
        event({
          title: 'must not be written',
          seriesId: 'victim-master',
          recurrenceId: '20261102T090000Z',
        }),
      ]),
    )
    expect(await response.json()).toMatchObject({ skippedEvents: 1 })
    expect(fake.row('imported')).toMatchObject({
      title: 'Imported event',
      seriesId: null,
    })
  })

  it('rejects a category owned by another user', async () => {
    fake.seed(
      { id: 'foreign-category', userId: STRANGER },
      'calendar_categories',
    )
    const response = await POST(
      request([event({ categoryId: 'foreign-category' })]),
    )
    expect(await response.json()).toMatchObject({ skippedEvents: 1 })
    expect(fake.row('imported')).toBeUndefined()
  })
})
