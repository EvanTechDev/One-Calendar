// @vitest-environment node
/**
 * The MCP `following` update splits a series exactly as the REST route does,
 * and must carry participant grants across the boundary for the same reason:
 * invites are bound to the master, so the new segment has none unless they are
 * carried, and the emptied old master's invites are then deleted outright. See
 * ADR-0009 (invites and their visibility survive a series split).
 *
 * This was the ADR-0009 failure still fully live on the agent surface — a
 * routine reschedule revoked every participant's link for the tail.
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

import { updateEvent } from '@/lib/mcp/event-tools'

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

function seedInvite(overrides: Record<string, unknown> = {}) {
  fake.seed(
    {
      id: 'inv1',
      eventId: 'm1',
      email: 'c@example.com',
      status: 'accepted',
      inviteToken: 'tok-stable',
      emailSent: true,
      addedToCalendar: true,
      categoryId: null,
      baselineKind: 'all',
      fromStamp: null,
      untilStamp: null,
      expiresAt: null,
      createdAt: day(2026, 7, 1),
      updatedAt: day(2026, 7, 1),
      ...overrides,
    },
    'event_invites',
  )
}

beforeEach(() => {
  fake.reset()
})

describe('MCP following update carries invites across the split', () => {
  it('carries an unbounded grant onto the new master, keeping the token', async () => {
    seedMaster()
    seedInvite()

    await updateEvent('u1', 'm1_20260810T090000Z', {
      apply_to: 'following',
      start_date: '2026-08-10T09:00:00Z',
      end_date: '2026-08-10T09:30:00Z',
    })

    const newMaster = fake
      .rows()
      .find((r) => r.id !== 'm1' && typeof r.rrule === 'string')
    expect(newMaster).toBeDefined()

    const carried = fake
      .rows('event_invites')
      .find((r) => r.eventId === newMaster!.id)
    expect(carried).toBeDefined()
    // The same token: a split is the organiser's edit and must not invalidate
    // the participant's existing link or trigger a new invitation email.
    expect(carried!.inviteToken).toBe('tok-stable')
    expect(carried!.baselineKind).toBe('all')
    // A same-time split shifts nothing: the grant starts at the boundary.
    expect(carried!.fromStamp).toBe('20260810T090000Z')

    // The old master keeps only what precedes the boundary.
    const original = fake.rows('event_invites').find((r) => r.id === 'inv1')
    expect(original!.untilStamp).toBe('20260810T090000Z')
  })

  it('carries the grant inside the split transaction', async () => {
    seedMaster()
    seedInvite()

    await updateEvent('u1', 'm1_20260810T090000Z', {
      apply_to: 'following',
      start_date: '2026-08-10T09:00:00Z',
      end_date: '2026-08-10T09:30:00Z',
    })

    const txBegin = fake.ops.indexOf('tx:begin')
    const txCommit = fake.ops.indexOf('tx:commit')
    const inviteInsert = fake.ops.findIndex((op) =>
      op.startsWith('insert:event_invites:'),
    )
    expect(inviteInsert).toBeGreaterThan(txBegin)
    expect(inviteInsert).toBeLessThan(txCommit)
  })

  it('carries the grant before deleting an emptied old master', async () => {
    // Splitting at the series' first slot empties the old master, whose invites
    // deleteCalendarEventRow then removes. The carry-over must happen first or
    // the grant is destroyed with nothing having been preserved.
    seedMaster()
    seedInvite()

    await updateEvent('u1', 'm1_20260803T090000Z', {
      apply_to: 'following',
      start_date: '2026-08-03T09:00:00Z',
      end_date: '2026-08-03T09:30:00Z',
    })

    const newMaster = fake
      .rows()
      .find((r) => r.id !== 'm1' && typeof r.rrule === 'string')!
    const carried = fake
      .rows('event_invites')
      .find((r) => r.eventId === newMaster.id)
    expect(carried).toBeDefined()
    expect(carried!.inviteToken).toBe('tok-stable')
  })

  it('does not carry a grant that ends before the split boundary', async () => {
    seedMaster()
    seedInvite({
      fromStamp: '20260803T090000Z',
      untilStamp: '20260804T090000Z',
    })

    await updateEvent('u1', 'm1_20260810T090000Z', {
      apply_to: 'following',
      start_date: '2026-08-10T09:00:00Z',
      end_date: '2026-08-10T09:30:00Z',
    })

    const newMaster = fake
      .rows()
      .find((r) => r.id !== 'm1' && typeof r.rrule === 'string')!
    expect(
      fake.rows('event_invites').find((r) => r.eventId === newMaster.id),
    ).toBeUndefined()
  })

  it('carries a tail exception with its visibility and RSVP intact', async () => {
    seedMaster()
    seedInvite()
    fake.seed(
      {
        id: 'occ1',
        inviteId: 'inv1',
        recurrenceId: '20260817T090000Z',
        visible: false,
        status: 'declined',
        createdAt: day(2026, 7, 5),
        updatedAt: day(2026, 7, 5),
      },
      'event_invite_occurrences',
    )

    await updateEvent('u1', 'm1_20260810T090000Z', {
      apply_to: 'following',
      start_date: '2026-08-10T09:00:00Z',
      end_date: '2026-08-10T09:30:00Z',
    })

    const newMaster = fake
      .rows()
      .find((r) => r.id !== 'm1' && typeof r.rrule === 'string')!
    const carried = fake
      .rows('event_invites')
      .find((r) => r.eventId === newMaster.id)!
    const carriedExceptions = fake
      .rows('event_invite_occurrences')
      .filter((r) => r.inviteId === carried.id)
    expect(carriedExceptions).toHaveLength(1)
    expect(carriedExceptions[0].recurrenceId).toBe('20260817T090000Z')
    expect(carriedExceptions[0].visible).toBe(false)
    expect(carriedExceptions[0].status).toBe('declined')
  })
})
