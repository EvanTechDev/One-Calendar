// @vitest-environment node
/**
 * BUG-02: a "this and following" split lost the Series' Meeting.
 *
 * `moveMeetingToEvent` was guarded by `if (split.masterBecomesEmpty)`, so the
 * ordinary mid-series split — the common case — never moved it. The FUTURE
 * segment, the part participants are actually going to attend, was left with no
 * meeting, while the past segment kept a link nobody would use again. Invites
 * were already carried unconditionally (ADR-0009), so the two halves of the same
 * split disagreed about what survives it.
 *
 * A Series has exactly one Meeting whose link is stable across occurrences
 * (ADR-0019), which is precisely why it has to follow the tail.
 *
 * Both `masterBecomesEmpty` values are covered: splitting at the first
 * occurrence (master becomes empty and is deleted) and splitting mid-series
 * (master survives, truncated).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getFakeDb } from './route-test-db'

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  const { drizzleOperatorsMock } = await import('./route-test-db')
  return { ...actual, ...drizzleOperatorsMock }
})

vi.mock('@/lib/drizzle/client', async () => {
  const { getFakeDb } = await import('./route-test-db')
  return { getDb: () => getFakeDb().db }
})

vi.mock('@/lib/api-helpers', () => ({
  getAuthedUser: async () => ({ id: 'u1', email: 'u1@example.com' }),
  decryptEvent: (e: unknown) => e,
}))

vi.mock('@/lib/field-crypto', () => ({
  encryptField: (_id: string, v: unknown) => v,
  encryptJsonField: (_id: string, v: unknown) => v,
}))

vi.mock('@/lib/cache/events', () => ({
  getCachedEvents: async () => null,
  setCachedEvents: async () => {},
  invalidateEventCache: async () => {},
  groupByMonth: () => ({}),
}))

vi.mock('@/lib/cache/keys', () => ({ fullMonthRange: () => [] }))

import { POST, DELETE } from '@/app/api/events/route'

const fake = getFakeDb()

function day(y: number, m: number, d: number, h = 0, min = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h, min))
}

/** Weekly Monday series anchored 2026-08-03T09:00Z (a Monday), 30 min. */
function seedMaster(overrides: Record<string, unknown> = {}) {
  fake.seed({
    id: 'm1',
    userId: 'u1',
    title: 'Team sync',
    description: null,
    location: null,
    startDate: day(2026, 8, 3, 9),
    endDate: day(2026, 8, 3, 9, 30),
    isAllDay: false,
    status: 'confirmed',
    color: null,
    categoryId: null,
    participants: null,
    notificationMinutes: null,
    emailReminder: false,
    createdAt: day(2026, 7, 1),
    updatedAt: day(2026, 7, 1),
    rrule: 'FREQ=WEEKLY;BYDAY=MO',
    exdate: null,
    seriesId: null,
    recurrenceId: null,
    ...overrides,
  })
}

/** The Series' single Meeting, attached to the master row (ADR-0019). */
function seedMeeting() {
  fake.seed(
    {
      id: 'abcd-efgh',
      organiserId: 'u1',
      creatorTokenHash: null,
      eventId: 'm1',
      accessPolicy: 'open',
      endedAt: null,
      expiresAt: null,
      createdAt: day(2026, 7, 1),
      updatedAt: day(2026, 7, 1),
    },
    'meeting',
  )
}

function putRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/events', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

function deleteRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/events', {
    method: 'DELETE',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

const baseUpdateFields = {
  title: 'Team sync',
  timezone: 'UTC',
}

function meetingRow() {
  return fake.rows('meeting').find((row) => row.id === 'abcd-efgh')
}

beforeEach(() => {
  fake.reset()
})

describe('a series split carries the Meeting to the tail (BUG-02)', () => {
  it('moves it on a MID-SERIES split, where the master survives', async () => {
    // masterBecomesEmpty === false. This is the case the old guard skipped
    // entirely, and the common one: the 3 Aug occurrence stays behind, so the
    // master is truncated rather than deleted.
    seedMaster()
    seedMeeting()
    const newId = '00000000-0000-4000-8000-000000000201'

    const res = await POST(
      putRequest({
        ...baseUpdateFields,
        id: 'm1_20260810T090000Z',
        apply_to: 'following',
        startDate: '2026-08-10T11:00:00Z',
        endDate: '2026-08-10T11:30:00Z',
        split_id: newId,
      }),
    )
    expect(res.status).toBe(200)

    // The master survived (truncated), proving this is the non-empty branch.
    const master = fake.row('m1')
    expect(master).toBeDefined()
    expect(master!.rrule as string).toContain('UNTIL=')

    // The meeting followed the tail.
    expect(meetingRow()?.eventId).toBe(newId)
  })

  it('moves it on a FIRST-OCCURRENCE split, where the master is deleted', async () => {
    // masterBecomesEmpty === true. The move must happen BEFORE the master's
    // delete, or the cascade would take the meeting with it.
    seedMaster()
    seedMeeting()
    const newId = '00000000-0000-4000-8000-000000000202'

    const res = await POST(
      putRequest({
        ...baseUpdateFields,
        id: 'm1_20260803T090000Z',
        apply_to: 'following',
        startDate: '2026-08-03T11:00:00Z',
        endDate: '2026-08-03T11:30:00Z',
        split_id: newId,
      }),
    )
    expect(res.status).toBe(200)

    // The emptied master is gone, so the meeting had nowhere to hide.
    expect(fake.row('m1')).toBeUndefined()
    expect(meetingRow()?.eventId).toBe(newId)
  })

  it('moves it inside the split transaction', async () => {
    // The whole split is one atomic unit; a meeting re-pointed outside it could
    // survive a rolled-back split pointing at a master that never existed.
    seedMaster()
    seedMeeting()
    const newId = '00000000-0000-4000-8000-000000000203'

    await POST(
      putRequest({
        ...baseUpdateFields,
        id: 'm1_20260810T090000Z',
        apply_to: 'following',
        startDate: '2026-08-10T11:00:00Z',
        endDate: '2026-08-10T11:30:00Z',
        split_id: newId,
      }),
    )

    const txBegin = fake.ops.indexOf('tx:begin')
    const txCommit = fake.ops.indexOf('tx:commit')
    const move = fake.ops.findIndex((op) => op.startsWith('update:meeting:'))
    expect(txBegin).toBeGreaterThanOrEqual(0)
    expect(move).toBeGreaterThan(txBegin)
    expect(move).toBeLessThan(txCommit)
  })

  it('leaves an event with no meeting untouched', async () => {
    // The move must be a no-op, not an error, for the overwhelming majority of
    // series that have no meeting at all.
    seedMaster()
    const newId = '00000000-0000-4000-8000-000000000204'

    const res = await POST(
      putRequest({
        ...baseUpdateFields,
        id: 'm1_20260810T090000Z',
        apply_to: 'following',
        startDate: '2026-08-10T11:00:00Z',
        endDate: '2026-08-10T11:30:00Z',
        split_id: newId,
      }),
    )
    expect(res.status).toBe(200)
    expect(fake.rows('meeting')).toHaveLength(0)
  })
})

describe('deleting a series segment does not orphan its Meeting (SEC-03)', () => {
  it('removes the meeting when the whole series is deleted', async () => {
    seedMaster()
    seedMeeting()

    const res = await DELETE(
      deleteRequest({ id: 'm1', apply_to: 'all', timezone: 'UTC' }),
    )
    expect(res.status).toBe(200)
    expect(meetingRow()).toBeUndefined()
  })

  it('removes the meeting when "this and following" deletes the tail', async () => {
    // The split re-points the meeting at the new tail master, which this path
    // then deletes. Bypassing deleteRow here left a joinable room attached to an
    // event that no longer exists — and for a signed-in organiser nobody can
    // ever end it.
    seedMaster()
    seedMeeting()

    const res = await DELETE(
      deleteRequest({
        id: 'm1_20260810T090000Z',
        apply_to: 'following',
        timezone: 'UTC',
      }),
    )
    expect(res.status).toBe(200)
    expect(meetingRow()).toBeUndefined()
  })
})
