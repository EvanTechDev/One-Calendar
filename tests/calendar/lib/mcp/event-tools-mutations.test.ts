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
  decryptFieldStrict: (_id: string, v: unknown) => v,
  looksLikeEnvelope: () => true,
}))

import {
  updateEvent,
  deleteEvent,
  listEvents,
  getEvent,
} from '@/lib/mcp/event-tools'
import { expandRows, type EventRow } from '@/lib/event-service'

vi.mock('@/lib/mcp/settings-tools', () => ({
  getSettings: vi.fn(async () => ({ timezone: 'UTC' })),
}))
import { getSettings } from '@/lib/mcp/settings-tools'

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
  vi.mocked(getSettings).mockResolvedValue({ timezone: 'UTC' })
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
    // The user's timezone is UTC in this fixture.
    expect(fake.row('m1')!.startDate).toEqual(day(2026, 8, 3, 11))
    expect(fake.row('m1')!.exdate).toEqual(['20260817T110000Z'])
    expect(fake.row('o1')!.recurrenceId).toBe('20260810T110000Z')
  })

  it('updateEvent single colour-only change creates a complete override row', async () => {
    seedMaster()

    const result = await updateEvent('u1', 'm1_20260810T090000Z', {
      apply_to: 'single',
      color: 'blue',
    })

    expect(result).not.toBeNull()
    const override = fake.rows().find((r) => r.seriesId === 'm1')
    expect(override).toBeDefined()
    expect(override!.recurrenceId).toBe('20260810T090000Z')
    // A fresh override must be a complete row — NOT NULL columns inherited
    // from the occurrence it edits — otherwise the insert fails and the agent
    // sees 'Internal server error' (CORE-219).
    expect(override!.title).toBe('Team sync')
    expect(override!.startDate).toEqual(day(2026, 8, 10, 9))
    expect(override!.endDate).toEqual(day(2026, 8, 10, 9, 30))
    expect(override!.isAllDay).toBe(false)
    expect(override!.status).toBe('confirmed')
    expect(override!.color).toBe('bg-[#E6F6FD]')
    expect(fake.row('m1')!.exdate).toEqual(['20260810T090000Z'])
  })

  it('updateEvent following colour-only change keeps the pattern day', async () => {
    // Mon/Thu/Sat series anchored Monday 2026-10-05 09:00Z.
    seedMaster({
      startDate: day(2026, 10, 5, 9),
      endDate: day(2026, 10, 5, 9, 30),
      rrule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TH,SA;UNTIL=20261031T000000Z',
    })

    const result = await updateEvent('u1', 'm1_20261015T090000Z', {
      apply_to: 'following',
      color: 'blue',
    })

    expect(result).not.toBeNull()
    const tail = fake
      .rows()
      .find((r) => r.id !== 'm1' && !r.seriesId && r.rrule)
    expect(tail).toBeDefined()
    expect(tail!.startDate).toEqual(day(2026, 10, 15, 9))
    expect(tail!.endDate).toEqual(day(2026, 10, 15, 9, 30))
    expect(tail!.title).toBe('Team sync')
    expect(tail!.color).toBe('bg-[#E6F6FD]')
    expect(tail!.rrule).toContain('BYDAY=MO,TH,SA')
  })

  it('an all-day colour-only override retains the organiser midnight', async () => {
    vi.mocked(getSettings).mockResolvedValue({ timezone: 'Asia/Shanghai' })
    seedMaster({
      startDate: new Date('2026-10-04T16:00:00Z'),
      endDate: new Date('2026-10-05T16:00:00Z'),
      isAllDay: true,
    })
    const id = 'm1_20261012'
    const before = await getEvent('u1', id)
    const after = await updateEvent('u1', id, {
      apply_to: 'single',
      color: 'blue',
    })
    expect(before!.startDate).toEqual(new Date('2026-10-11T16:00:00Z'))
    expect(after).toMatchObject({
      title: 'Team sync',
      startDate: before!.startDate,
      endDate: before!.endDate,
      isAllDay: true,
      color: 'bg-[#E6F6FD]',
    })
  })

  it('MCP query then following colour edit preserves the dates shown in the user timezone', async () => {
    vi.mocked(getSettings).mockResolvedValue({ timezone: 'Asia/Shanghai' })
    seedMaster({
      startDate: new Date('2026-10-04T23:00:00Z'),
      endDate: new Date('2026-10-04T23:30:00Z'),
      rrule: 'FREQ=WEEKLY;BYDAY=MO,TH,SA;UNTIL=20261031T000000Z',
    })
    const window = {
      windowStart: day(2026, 10, 1),
      windowEnd: day(2026, 11, 1),
      timezone: 'Asia/Shanghai',
    }
    const before = expandRows(fake.rows() as unknown as EventRow[], window)
    const queried = await listEvents('u1', {
      start_date: window.windowStart.toISOString(),
      end_date: window.windowEnd.toISOString(),
    })
    expect(queried.events.map((e) => e.id)).toEqual(
      before.map((e) => e.instanceId),
    )
    const selected = queried.events[4]
    await updateEvent('u1', selected.id as string, {
      apply_to: 'following',
      color: 'blue',
    })
    const rows = fake
      .rows()
      .map((r) => ({ ...r, seriesId: r.seriesId ?? null }))
    const after = expandRows(rows as unknown as EventRow[], window)
    expect(after.map((e) => e.startDate.toISOString()).sort()).toEqual(
      before.map((e) => e.startDate.toISOString()).sort(),
    )
    expect(
      after
        .filter((e) => e.startDate >= before[4].startDate)
        .every((e) => e.color === 'bg-[#E6F6FD]'),
    ).toBe(true)
  })
})
