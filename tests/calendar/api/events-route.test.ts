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
  decryptFieldStrict: (_id: string, v: unknown) => v,
  looksLikeEnvelope: () => true,
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

  it('characterizes DELETE single (master id) with override: deletes override AND adds exdate', async () => {
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
    // Fixed by plan 002: the override row is deleted along with the exdate
    // write, mirroring the instance-id branch, so no ghost survives.
    expect(fake.ops).toContain('delete:calendar_events:id=o1')
    expect(fake.row('o1')).toBeUndefined()
  })

  it('characterizes PUT all (instance id): remaps exdates and override stamps', async () => {
    seedMaster({ exdate: ['20260817T090000Z'] })
    seedOverride('o1', '20260810T090000Z')

    // Target the FIRST occurrence — since plan 004, mid-series instances
    // reject apply_to 'all' with a 400.
    const res = await POST(
      putRequest({
        ...baseUpdateFields,
        id: 'm1_20260803T090000Z',
        apply_to: 'all',
        // +2h clock move: the first instance dragged from 09:00 to 11:00.
        startDate: '2026-08-03T11:00:00Z',
        endDate: '2026-08-03T11:30:00Z',
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

  it('rejects PUT all (instance id) on a NON-first occurrence with 400', async () => {
    seedMaster()

    const res = await POST(
      putRequest({
        ...baseUpdateFields,
        // Aug 10 is the SECOND Monday of the series.
        id: 'm1_20260810T090000Z',
        apply_to: 'all',
        startDate: '2026-08-10T11:00:00Z',
        endDate: '2026-08-10T11:30:00Z',
      }),
    )

    expect(res.status).toBe(400)
    // No mutation ran.
    expect(fake.writes).toHaveLength(0)
  })

  it('allows PUT all (instance id) on the first occurrence', async () => {
    seedMaster()

    const res = await POST(
      putRequest({
        ...baseUpdateFields,
        id: 'm1_20260803T090000Z',
        apply_to: 'all',
        startDate: '2026-08-03T11:00:00Z',
        endDate: '2026-08-03T11:30:00Z',
      }),
    )

    expect(res.status).toBe(200)
    expect(fake.writes.some((w) => w.op === 'update' && w.id === 'm1')).toBe(
      true,
    )
  })

  it('allows PUT all (master id) regardless of occurrence', async () => {
    seedMaster()

    const res = await POST(
      putRequest({
        ...baseUpdateFields,
        id: 'm1',
        apply_to: 'all',
        startDate: '2026-08-03T11:00:00Z',
        endDate: '2026-08-03T11:30:00Z',
      }),
    )

    expect(res.status).toBe(200)
    expect(fake.writes.some((w) => w.op === 'update' && w.id === 'm1')).toBe(
      true,
    )
  })

  it('following on a Mon/Wed/Fri/Sun series dragged to Tuesday keeps the parent pattern', async () => {
    // The reported bug: dragging Wednesday's instance to Tuesday 15:00 and
    // saving "this and following" duplicated the event onto Tuesday AND
    // moved the whole tail onto Tuesday's slot. Expected: the tail stays on
    // Mon/Wed/Fri/Sun and only adopts 15:00-17:00.
    fake.reset()
    seedMaster({ rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR,SU' })
    const newId = '00000000-0000-4000-8000-0000000000ff'

    const res = await POST(
      putRequest({
        title: 'Team sync',
        timezone: 'UTC',
        id: 'm1_20260805T090000Z', // Wednesday
        apply_to: 'following',
        // dragged onto Tuesday 15:00-17:00
        startDate: '2026-08-04T15:00:00Z',
        endDate: '2026-08-04T17:00:00Z',
        split_id: newId,
      }),
    )

    expect(res.status).toBe(200)
    const created = fake.row(newId)!
    // Anchored back on Wednesday, with the new clock.
    expect(created.startDate).toEqual(day(2026, 8, 5, 15))
    expect(created.endDate).toEqual(day(2026, 8, 5, 17))
    // The parent pattern is intact — no Tuesday was introduced.
    expect(created.rrule).toContain('BYDAY=MO,WE,FR,SU')
    expect(created.rrule as string).not.toMatch(/BYDAY=[^;]*TU/)
  })

  it('all events on a Mon/Wed/Fri/Sun series dragged to Tuesday translates the whole pattern', async () => {
    // Dragging the FIRST occurrence (Monday) to Tuesday with "all events"
    // shifts every slot by +1 day: Mon/Wed/Fri/Sun → Tue/Thu/Sat/Mon.
    fake.reset()
    seedMaster({
      rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR,SU',
      exdate: ['20260817T090000Z'], // a Monday exclusion
    })

    const res = await POST(
      putRequest({
        title: 'Team sync',
        timezone: 'UTC',
        id: 'm1_20260803T090000Z', // the first occurrence (Monday)
        apply_to: 'all',
        startDate: '2026-08-04T15:00:00Z', // → Tuesday 15:00
        endDate: '2026-08-04T17:00:00Z',
      }),
    )

    expect(res.status).toBe(200)
    const master = fake.row('m1')!
    // Anchor moved a full day and adopted the new clock.
    expect(master.startDate).toEqual(day(2026, 8, 4, 15))
    expect(master.endDate).toEqual(day(2026, 8, 4, 17))
    // Whole pattern rotated by +1 day.
    const byday = /BYDAY=([^;]+)/
      .exec(master.rrule as string)![1]
      .split(',')
      .sort()
    expect(byday).toEqual(['MO', 'SA', 'TH', 'TU'])
    // The Monday exclusion travelled with it → the following Tuesday.
    expect(master.exdate).toEqual(['20260818T150000Z'])
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
    // All four split writes happen inside one transaction (plan 003).
    const txBegin = fake.ops.indexOf('tx:begin')
    const txCommit = fake.ops.indexOf('tx:commit')
    expect(txBegin).toBeGreaterThanOrEqual(0)
    expect(txBegin).toBeLessThan(insertNew)
    expect(txCommit).toBeGreaterThan(
      fake.ops.lastIndexOf('update:calendar_events:id=m1'),
    )
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

/**
 * A `following` edit splits the series. Invites are bound to the master, so
 * without explicit carry-over the new segment has none and participants
 * silently lose access to the tail. See
 * ADR-0009 (invites and their visibility survive a series split).
 */
describe('invites survive a series split', () => {
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

  it('carries an unbounded grant onto the new master, keeping the token', async () => {
    seedMaster()
    seedInvite()
    const newId = '00000000-0000-4000-8000-000000000101'

    const res = await POST(
      putRequest({
        ...baseUpdateFields,
        id: 'm1_20260810T090000Z',
        apply_to: 'following',
        split_id: newId,
      }),
    )
    expect(res.status).toBe(200)

    const carried = fake.rows('event_invites').find((r) => r.eventId === newId)
    expect(carried).toBeDefined()
    // The same token: a split is the organiser's edit and must not invalidate
    // the participant's existing link or trigger a new invitation email.
    expect(carried!.inviteToken).toBe('tok-stable')
    expect(carried!.baselineKind).toBe('all')

    // The old master keeps only what precedes the boundary.
    const original = fake.rows('event_invites').find((r) => r.id === 'inv1')
    expect(original!.untilStamp).toBe('20260810T090000Z')
  })

  it('carries the grant inside the split transaction', async () => {
    seedMaster()
    seedInvite()
    const newId = '00000000-0000-4000-8000-000000000102'

    await POST(
      putRequest({
        ...baseUpdateFields,
        id: 'm1_20260810T090000Z',
        apply_to: 'following',
        split_id: newId,
      }),
    )

    const txBegin = fake.ops.indexOf('tx:begin')
    const txCommit = fake.ops.indexOf('tx:commit')
    const inviteInsert = fake.ops.findIndex((op) =>
      op.startsWith('insert:event_invites:'),
    )
    expect(inviteInsert).toBeGreaterThan(txBegin)
    expect(inviteInsert).toBeLessThan(txCommit)
  })

  it('does not carry a grant that ends before the split boundary', async () => {
    seedMaster()
    // Visible only up to 3 Aug; the tail starting 10 Aug is not theirs.
    seedInvite({
      fromStamp: '20260803T090000Z',
      untilStamp: '20260804T090000Z',
    })
    const newId = '00000000-0000-4000-8000-000000000103'

    await POST(
      putRequest({
        ...baseUpdateFields,
        id: 'm1_20260810T090000Z',
        apply_to: 'following',
        split_id: newId,
      }),
    )

    expect(
      fake.rows('event_invites').find((r) => r.eventId === newId),
    ).toBeUndefined()
  })

  it('keeps one row per (event, token) so the shared token is legal', async () => {
    // The token is reused across segments on purpose (ADR-0009), which is why
    // invite_token is NOT globally unique — uniqueness is (invite_token,
    // event_id). Two rows sharing a token must therefore differ by event.
    seedMaster()
    seedInvite()
    const newId = '00000000-0000-4000-8000-000000000105'

    await POST(
      putRequest({
        ...baseUpdateFields,
        id: 'm1_20260810T090000Z',
        apply_to: 'following',
        split_id: newId,
      }),
    )

    const sharing = fake
      .rows('event_invites')
      .filter((r) => r.inviteToken === 'tok-stable')
    expect(sharing).toHaveLength(2)
    expect(new Set(sharing.map((r) => r.eventId)).size).toBe(2)
  })

  function seedException(overrides: Record<string, unknown> = {}) {
    fake.seed(
      {
        id: 'occ1',
        inviteId: 'inv1',
        recurrenceId: '20260817T090000Z',
        visible: true,
        status: 'accepted',
        createdAt: day(2026, 7, 5),
        updatedAt: day(2026, 7, 5),
        ...overrides,
      },
      'event_invite_occurrences',
    )
  }

  it('leaves a carried grant at the boundary when the split changes no clock', async () => {
    // THE STAMP-DELTA BUG. The delta was measured from the series ANCHOR
    // (3 Aug) to the boundary day (10 Aug), so a `following` edit that touches
    // no clock still moved every carried stamp forward by seven days: the
    // participant lost the start of the tail they were granted.
    seedMaster()
    seedInvite()
    const newId = '00000000-0000-4000-8000-000000000106'

    const res = await POST(
      putRequest({
        ...baseUpdateFields,
        id: 'm1_20260810T090000Z',
        apply_to: 'following',
        split_id: newId,
      }),
    )
    expect(res.status).toBe(200)

    const carried = fake.rows('event_invites').find((r) => r.eventId === newId)
    expect(carried!.fromStamp).toBe('20260810T090000Z')
  })

  it('remaps a carried grant onto the new clock, keeping its day', async () => {
    // A genuine time-of-day change must move the stamp's clock and nothing
    // else — the same clock remap shiftOverridesByDelta applies to overrides.
    seedMaster()
    seedInvite()
    const newId = '00000000-0000-4000-8000-000000000107'

    const res = await POST(
      putRequest({
        title: 'Team sync',
        timezone: 'UTC',
        id: 'm1_20260810T090000Z',
        apply_to: 'following',
        // 09:00 → 11:00 on the boundary occurrence's own day.
        startDate: '2026-08-10T11:00:00Z',
        endDate: '2026-08-10T11:30:00Z',
        split_id: newId,
      }),
    )
    expect(res.status).toBe(200)

    const carried = fake.rows('event_invites').find((r) => r.eventId === newId)
    expect(carried!.fromStamp).toBe('20260810T110000Z')
  })

  it('caps a bounded carried grant at its own end, remapped not shifted', async () => {
    seedMaster()
    seedInvite({ untilStamp: '20260901T090000Z' })
    const newId = '00000000-0000-4000-8000-000000000108'

    await POST(
      putRequest({
        ...baseUpdateFields,
        id: 'm1_20260810T090000Z',
        apply_to: 'following',
        split_id: newId,
      }),
    )

    const carried = fake.rows('event_invites').find((r) => r.eventId === newId)
    // A same-time split must not extend the grant past what was granted.
    expect(carried!.untilStamp).toBe('20260901T090000Z')
  })

  it('carries a tail exception with its stamp, visibility and RSVP intact', async () => {
    seedMaster()
    seedInvite()
    seedException({ visible: false, status: 'declined' })
    const newId = '00000000-0000-4000-8000-000000000109'

    await POST(
      putRequest({
        ...baseUpdateFields,
        id: 'm1_20260810T090000Z',
        apply_to: 'following',
        split_id: newId,
      }),
    )

    const carried = fake.rows('event_invites').find((r) => r.eventId === newId)!
    const carriedExceptions = fake
      .rows('event_invite_occurrences')
      .filter((r) => r.inviteId === carried.id)
    expect(carriedExceptions).toHaveLength(1)
    // Same-time split: the stamp the new series generates is unchanged, so a
    // shifted stamp would be an unreadable orphan row.
    expect(carriedExceptions[0].recurrenceId).toBe('20260817T090000Z')
    expect(carriedExceptions[0].visible).toBe(false)
    expect(carriedExceptions[0].status).toBe('declined')

    // The old master keeps only what precedes the boundary.
    expect(
      fake
        .rows('event_invite_occurrences')
        .filter((r) => r.inviteId === 'inv1'),
    ).toHaveLength(0)
  })

  it('remaps a carried tail exception onto the new clock', async () => {
    seedMaster()
    seedInvite()
    seedException()
    const newId = '00000000-0000-4000-8000-00000000010a'

    await POST(
      putRequest({
        title: 'Team sync',
        timezone: 'UTC',
        id: 'm1_20260810T090000Z',
        apply_to: 'following',
        startDate: '2026-08-10T11:00:00Z',
        endDate: '2026-08-10T11:30:00Z',
        split_id: newId,
      }),
    )

    const carried = fake.rows('event_invites').find((r) => r.eventId === newId)!
    const carriedExceptions = fake
      .rows('event_invite_occurrences')
      .filter((r) => r.inviteId === carried.id)
    expect(carriedExceptions).toHaveLength(1)
    // 17 Aug stays 17 Aug; only the clock follows the series.
    expect(carriedExceptions[0].recurrenceId).toBe('20260817T110000Z')
  })

  it('carries the grant before deleting an emptied old master', async () => {
    // Splitting at the series' first slot empties the old master, whose invites
    // are then deleted. The carry-over must happen first or the grant is lost.
    seedMaster()
    seedInvite()
    const newId = '00000000-0000-4000-8000-000000000104'

    await POST(
      putRequest({
        title: 'Team sync',
        startDate: '2026-08-03T09:00:00Z',
        endDate: '2026-08-03T09:30:00Z',
        timezone: 'UTC',
        id: 'm1_20260803T090000Z',
        apply_to: 'following',
        split_id: newId,
      }),
    )

    const carried = fake.rows('event_invites').find((r) => r.eventId === newId)
    expect(carried).toBeDefined()
    expect(carried!.inviteToken).toBe('tok-stable')
  })
})
