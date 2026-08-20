// @vitest-environment node
/**
 * Characterization tests for the MCP event tools' mutation layer
 * (updateEvent/deleteEvent). They pin the CURRENT write behavior — including
 * two known bugs (missing exdate on single delete with override; no stamp
 * remap on 'all' updates) — so plan 002 can flip exactly the intended
 * assertions. Uses the same fake db harness as the route tests.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getFakeDb } from '../../api/route-test-db'

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  const { drizzleOperatorsMock } = await import('../../api/route-test-db')
  return { ...actual, ...drizzleOperatorsMock }
})

vi.mock('@/lib/drizzle/client', async () => {
  const { getFakeDb } = await import('../../api/route-test-db')
  return { getDb: () => getFakeDb().db }
})

vi.mock('@/lib/api-helpers', () => ({
  decryptEvent: (e: unknown) => e,
}))

vi.mock('@/lib/field-crypto', () => ({
  encryptField: (_id: string, v: unknown) => v,
  encryptJsonField: (_id: string, v: unknown) => v,
}))

import { updateEvent, deleteEvent } from '@/lib/mcp/event-tools'

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

beforeEach(() => {
  fake.reset()
})

describe('MCP event tool mutations (characterization)', () => {
  it('characterizes MCP deleteEvent single with override: deletes override, does NOT add exdate (current behavior)', async () => {
    seedMaster()
    seedOverride('o1', '20260810T090000Z')

    await deleteEvent('u1', 'm1_20260810T090000Z', 'single')

    expect(fake.ops).toContain('delete:calendar_events:id=o1')
    expect(fake.row('o1')).toBeUndefined()
    // BUG (pinned): the master's exdate is never updated, so the unedited
    // base occurrence resurrects. Plan 002 flips this assertion.
    expect(fake.row('m1')!.exdate).toBeNull()
    expect(fake.writes.some((w) => w.op === 'update' && w.id === 'm1')).toBe(
      false,
    )
  })

  it('characterizes MCP updateEvent all: writes fields without any stamp remap (current behavior)', async () => {
    seedMaster({ exdate: ['20260817T090000Z'] })
    seedOverride('o1', '20260810T090000Z')

    await updateEvent('u1', 'm1_20260810T090000Z', {
      apply_to: 'all',
      // +2h clock move of the Aug 10 instance.
      start_date: '2026-08-10T11:00:00Z',
      end_date: '2026-08-10T11:30:00Z',
    })

    // BUG (pinned): fields are written verbatim — no shiftToAnchorClock
    // clamp (the master jumps to the instance's day), no exdate remap, no
    // override re-stamp. Plan 002 flips all three assertions.
    expect(fake.row('m1')!.startDate).toEqual(day(2026, 8, 10, 11))
    expect(fake.row('m1')!.exdate).toEqual(['20260817T090000Z'])
    expect(fake.row('o1')!.recurrenceId).toBe('20260810T090000Z')
  })
})
