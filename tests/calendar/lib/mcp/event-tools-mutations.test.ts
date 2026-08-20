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
  it('characterizes MCP deleteEvent single with override: deletes override AND adds exdate', async () => {
    seedMaster()
    seedOverride('o1', '20260810T090000Z')

    await deleteEvent('u1', 'm1_20260810T090000Z', 'single')

    expect(fake.ops).toContain('delete:calendar_events:id=o1')
    expect(fake.row('o1')).toBeUndefined()
    // Fixed by plan 002: both writes happen (mirroring the REST route), so
    // the unedited base occurrence cannot resurrect.
    expect(fake.row('m1')!.exdate).toEqual(['20260810T090000Z'])
  })

  it('characterizes MCP updateEvent all: clamps anchor, remaps exdates and override stamps', async () => {
    seedMaster({ exdate: ['20260817T090000Z'] })
    seedOverride('o1', '20260810T090000Z')

    // Target the FIRST occurrence — since plan 004, mid-series instances
    // reject apply_to 'all'.
    await updateEvent('u1', 'm1_20260803T090000Z', {
      apply_to: 'all',
      // +2h clock move of the first instance.
      start_date: '2026-08-03T11:00:00Z',
      end_date: '2026-08-03T11:30:00Z',
    })

    // Fixed by plan 002 (mirrors the REST route's instance-'all' sequence):
    // the master keeps its anchor day and adopts the new clock, stored
    // exdates follow the clock, and override stamps are re-mapped so the
    // edited instance keeps matching its occurrence.
    // NOTE: MCP passes no timeZone, so the clamp/remaps use server-local day
    // parts — tests run with UTC-equivalent expectations because the stamps
    // and dates here are all UTC-midnight-aligned days at fixed clocks.
    expect(fake.row('m1')!.startDate).toEqual(day(2026, 8, 3, 11))
    expect(fake.row('m1')!.exdate).toEqual(['20260817T110000Z'])
    expect(fake.row('o1')!.recurrenceId).toBe('20260810T110000Z')
  })
})
