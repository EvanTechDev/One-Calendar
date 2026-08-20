// @vitest-environment node
/**
 * Characterization tests for the events REST route's series mutation layer
 * (POST with body.id = update, DELETE). They pin the CURRENT write behavior
 * against an in-memory fake db (see route-test-db.ts) so follow-up bugfix
 * plans can flip individual assertions and prove exactly one behavior
 * changed. Test names are load-bearing: plans 002/003 refer to them.
 *
 * NOTE: response bodies are deliberately not asserted (only the db op log);
 * see plan 001 maintenance notes.
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
    createdAt: day(2026, 7, 1),
    updatedAt: day(2026, 7, 1),
    rrule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO',
    exdate: null,
    seriesId: null,
    recurrenceId: null,
    ...overrides,
  })
}

function seedOverride(
  id: string,
  recurrenceId: string,
  overrides: Record<string, unknown> = {},
) {
  fake.seed({
    id,
    userId: 'u1',
    title: 'Edited instance',
    description: null,
    location: null,
    startDate: day(2026, 8, 10, 9),
    endDate: day(2026, 8, 10, 9, 30),
    isAllDay: false,
    status: 'confirmed',
    color: null,
    categoryId: null,
    participants: null,
    notificationMinutes: null,
    createdAt: day(2026, 7, 2),
    updatedAt: day(2026, 7, 2),
    rrule: null,
    exdate: null,
    seriesId: 'm1',
    recurrenceId,
    ...overrides,
  })
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
  startDate: '2026-08-10T09:00:00Z',
  endDate: '2026-08-10T09:30:00Z',
  timezone: 'UTC',
}

beforeEach(() => {
  fake.reset()
})

describe('events route series mutations (characterization)', () => {
  it('characterizes DELETE single (instance id) with override: deletes override AND adds exdate', async () => {
    seedMaster()
    seedOverride('o1', '20260810T090000Z')

    const res = await DELETE(
      deleteRequest({ id: 'm1_20260810T090000Z', apply_to: 'single' }),
    )

    expect(res.status).toBe(200)
    expect(fake.ops).toContain('delete:calendar_events:id=o1')
    expect(fake.row('o1')).toBeUndefined()
    expect(fake.row('m1')!.exdate).toContain('20260810T090000Z')
  })

  it('characterizes DELETE single (master id) with override: adds exdate, KEEPS override (current behavior)', async () => {
    seedMaster()
    // Override sits on the series' FIRST stamp — the one the master-id
    // 'single' path targets via firstStampOfSeries.
    seedOverride('o1', '20260803T090000Z', {
      startDate: day(2026, 8, 3, 9),
      endDate: day(2026, 8, 3, 9, 30),
    })

    const res = await DELETE(deleteRequest({ id: 'm1', apply_to: 'single' }))

    expect(res.status).toBe(200)
    expect(fake.row('m1')!.exdate).toContain('20260803T090000Z')
    // BUG (pinned): the override row survives, so the engine re-renders the
    // deleted first instance as a ghost. Plan 002 flips this assertion.
    expect(fake.ops).not.toContain('delete:calendar_events:id=o1')
    expect(fake.row('o1')).toBeDefined()
  })

  it('characterizes PUT all (instance id): remaps exdates and override stamps', async () => {
    seedMaster({ exdate: ['20260817T090000Z'] })
    seedOverride('o1', '20260810T090000Z')

    const res = await POST(
      putRequest({
        ...baseUpdateFields,
        id: 'm1_20260810T090000Z',
        apply_to: 'all',
        // +2h clock move: the Aug 10 instance dragged from 09:00 to 11:00.
        startDate: '2026-08-10T11:00:00Z',
        endDate: '2026-08-10T11:30:00Z',
      }),
    )

    expect(res.status).toBe(200)
    // Master anchor keeps its day, adopts the new clock.
    expect(fake.row('m1')!.startDate).toEqual(day(2026, 8, 3, 11))
    // Stored exdate stamps follow the clock so deletions don't resurrect.
    expect(fake.row('m1')!.exdate).toEqual(['20260817T110000Z'])
    // Override stamps follow too, so the edited instance keeps matching.
    expect(fake.row('o1')!.recurrenceId).toBe('20260810T110000Z')
  })

  it('characterizes PUT all (master id): remaps exdates', async () => {
    seedMaster({ exdate: ['20260817T090000Z'] })
    seedOverride('o1', '20260810T090000Z')

    const res = await POST(
      putRequest({
        ...baseUpdateFields,
        id: 'm1',
        apply_to: 'all',
        // +2h clock move applied straight to the master row.
        startDate: '2026-08-03T11:00:00Z',
        endDate: '2026-08-03T11:30:00Z',
      }),
    )

    expect(res.status).toBe(200)
    // Overrides are remapped to the new clock…
    expect(fake.row('o1')!.recurrenceId).toBe('20260810T110000Z')
    // …and so are the stored exdates (fixed by plan 002): both stamp sets
    // follow the series into the new clock space in one operation.
    expect(fake.row('m1')!.exdate).toEqual(['20260817T110000Z'])
  })

  it('characterizes PUT following (instance id): split write sequence', async () => {
    seedMaster()
    seedOverride('o1', '20260810T090000Z')
    seedOverride('o2', '20260817T090000Z', {
      startDate: day(2026, 8, 17, 9),
      endDate: day(2026, 8, 17, 9, 30),
    })
    const newId = '00000000-0000-4000-8000-000000000001'

    const res = await POST(
      putRequest({
        ...baseUpdateFields,
        id: 'm1_20260810T090000Z',
        apply_to: 'following',
        split_id: newId,
      }),
    )

    expect(res.status).toBe(200)
    const insertNew = fake.ops.indexOf(`insert:calendar_events:id=${newId}`)
    const deleteTarget = fake.ops.indexOf('delete:calendar_events:id=o1')
    const reparent = fake.writes.findIndex(
      (w) => w.op === 'update' && w.id === 'o2' && w.data?.seriesId === newId,
    )
    const truncate = fake.writes.findIndex(
      (w) =>
        w.op === 'update' &&
        w.id === 'm1' &&
        typeof w.data?.rrule === 'string' &&
        (w.data.rrule as string).includes('UNTIL=20260810'),
    )
    expect(insertNew).toBeGreaterThanOrEqual(0)
    expect(deleteTarget).toBeGreaterThan(insertNew)
    expect(reparent).toBeGreaterThanOrEqual(0)
    expect(truncate).toBeGreaterThanOrEqual(0)
    // Write order: insert new master → delete target override → reparent
    // moved overrides → truncate old master.
    const reparentOp = fake.ops.indexOf('update:calendar_events:id=o2')
    expect(reparentOp).toBeGreaterThan(deleteTarget)
    const truncateOpIndex = fake.ops
      .map((op, i) => ({ op, i }))
      .filter(({ op }) => op === 'update:calendar_events:id=m1')
      .map(({ i }) => i)
      .find((i) => i > reparentOp)
    expect(truncateOpIndex).toBeDefined()
    // Old master got truncated with UNTIL at the split boundary.
    expect(fake.row('m1')!.rrule).toContain('UNTIL=20260810')
    // Moved override now belongs to the new series.
    expect(fake.row('o2')!.seriesId).toBe(newId)
  })
})
