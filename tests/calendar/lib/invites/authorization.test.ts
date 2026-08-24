// @vitest-environment node
/**
 * Authorization tests for participant visibility.
 *
 * The regression these pin: `isEventViewableBy` used to admit a viewer if ANY
 * invite existed for the event or its series, so a participant invited to one
 * occurrence could read every occurrence through /api/bookmarks and
 * /api/import. See ADR-0008 (visibility is decided in one place, shared by every reader).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const invites: Array<Record<string, unknown>> = []
const occurrences: Array<Record<string, unknown>> = []
const events: Array<Record<string, unknown>> = []

vi.mock('@/lib/drizzle/client', () => ({
  getDb: () => ({
    select: () => ({
      from: (table: { __name?: string }) => {
        const name = table.__name
        const source =
          name === 'event_invites'
            ? invites
            : name === 'event_invite_occurrences'
              ? occurrences
              : events
        const chain = {
          where: (predicate: (row: Record<string, unknown>) => boolean) => {
            const matched = source.filter((row) => predicate(row))
            return Object.assign(Promise.resolve(matched), {
              limit: () => Promise.resolve(matched.slice(0, 1)),
            })
          },
        }
        return chain
      },
    }),
  }),
}))

// Predicate-building stand-ins for the drizzle operators, so the fake above can
// filter rows without a database.
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq:
      (col: { name: string }, val: unknown) => (row: Record<string, unknown>) =>
        row[camel(col.name)] === val,
    and:
      (...preds: Array<(row: Record<string, unknown>) => boolean>) =>
      (row: Record<string, unknown>) =>
        preds.every((p) => p(row)),
    inArray:
      (col: { name: string }, vals: unknown[]) =>
      (row: Record<string, unknown>) =>
        vals.includes(row[camel(col.name)]),
  }
})

function camel(snake: string): string {
  return snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

vi.mock('@/lib/drizzle/schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/drizzle/schema')>()
  return {
    ...actual,
    calendarEvents: Object.assign({}, actual.calendarEvents, {
      __name: 'calendar_events',
    }),
    eventInvites: Object.assign({}, actual.eventInvites, {
      __name: 'event_invites',
    }),
    eventInviteOccurrences: Object.assign({}, actual.eventInviteOccurrences, {
      __name: 'event_invite_occurrences',
    }),
  }
})

import { isEventViewableBy } from '@/lib/bookmarks'

const PARTICIPANT = { id: 'u2', email: 'c@example.com' }
const DAY1 = '20260801T090000Z'
const DAY3 = '20260803T090000Z'

function seedInvite(overrides: Record<string, unknown> = {}) {
  invites.push({
    id: 'inv1',
    eventId: 'm1',
    email: 'c@example.com',
    status: 'pending',
    inviteToken: 'tok1',
    emailSent: true,
    addedToCalendar: true,
    categoryId: null,
    baselineKind: 'all',
    fromStamp: null,
    untilStamp: null,
    expiresAt: null,
    ...overrides,
  })
}

beforeEach(() => {
  invites.length = 0
  occurrences.length = 0
  events.length = 0
  // m1 is a series master: every `m1_<stamp>` id below is one of its
  // occurrences, so the master row must actually carry an rrule.
  events.push({ id: 'm1', userId: 'u1', rrule: 'FREQ=WEEKLY;BYDAY=MO' })
  // p1 is a plain, non-recurring event owned by the same organiser.
  events.push({ id: 'p1', userId: 'u1', rrule: null })
})

describe('isEventViewableBy', () => {
  it('admits the owner', async () => {
    expect(
      await isEventViewableBy('m1', { id: 'u1', email: 'u1@example.com' }),
    ).toBe(true)
  })

  it('refuses a stranger', async () => {
    expect(
      await isEventViewableBy('m1', { id: 'u9', email: 'nobody@example.com' }),
    ).toBe(false)
  })

  it('refuses an invite that was never added to the calendar', async () => {
    seedInvite({ addedToCalendar: false })
    expect(await isEventViewableBy(`m1_${DAY1}`, PARTICIPANT)).toBe(false)
  })

  it('admits a grant whose emailed link has expired', async () => {
    // Expiry ends the LINK, not the grant: once added to the calendar the
    // grant is permanent until revoked — see ADR-0013 (the invite link
    // expires; the grant does not). This test used to assert the opposite,
    // which locked participants out of long-lived events after 7 days.
    seedInvite({ expiresAt: new Date(Date.now() - 1000) })
    expect(await isEventViewableBy(`m1_${DAY1}`, PARTICIPANT)).toBe(true)
  })

  it('still refuses an expired link that never became a grant', async () => {
    // Without `addedToCalendar` there is no grant to outlive the link.
    seedInvite({
      addedToCalendar: false,
      expiresAt: new Date(Date.now() - 1000),
    })
    expect(await isEventViewableBy(`m1_${DAY1}`, PARTICIPANT)).toBe(false)
  })

  it('admits an occurrence inside the baseline', async () => {
    seedInvite()
    expect(await isEventViewableBy(`m1_${DAY1}`, PARTICIPANT)).toBe(true)
  })

  it('refuses an occurrence a single-scope grant does not cover', async () => {
    // THE REGRESSION. c is invited to day 3 only; day 1 must be refused.
    seedInvite({ baselineKind: 'none' })
    occurrences.push({
      id: 'occ1',
      inviteId: 'inv1',
      recurrenceId: DAY3,
      visible: true,
      status: 'pending',
    })

    expect(await isEventViewableBy(`m1_${DAY3}`, PARTICIPANT)).toBe(true)
    expect(await isEventViewableBy(`m1_${DAY1}`, PARTICIPANT)).toBe(false)
  })

  it('refuses an occurrence hidden by an exception', async () => {
    seedInvite()
    occurrences.push({
      id: 'occ1',
      inviteId: 'inv1',
      recurrenceId: DAY1,
      visible: false,
      status: 'pending',
    })
    expect(await isEventViewableBy(`m1_${DAY1}`, PARTICIPANT)).toBe(false)
    expect(await isEventViewableBy(`m1_${DAY3}`, PARTICIPANT)).toBe(true)
  })

  it('refuses an occurrence past a capped baseline', async () => {
    seedInvite({ fromStamp: DAY1, untilStamp: DAY3 })
    expect(await isEventViewableBy(`m1_${DAY1}`, PARTICIPANT)).toBe(true)
    expect(await isEventViewableBy(`m1_${DAY3}`, PARTICIPANT)).toBe(false)
  })

  it('admits the organiser asking for the series master id', async () => {
    seedInvite()
    expect(
      await isEventViewableBy('m1', { id: 'u1', email: 'u1@example.com' }),
    ).toBe(true)
  })

  it('refuses a participant asking for the series master id', async () => {
    // THE MASTER-ID HOLE. A master row carries the rrule and the exdates, and
    // decryptEvent spreads the whole row — so admitting this hands a
    // participant granted one occurrence the means to expand the entire series
    // client-side. There is no stamp here, therefore no grant to honour. See
    // ADR-0006 (participants never receive the recurrence rule).
    seedInvite({ baselineKind: 'none' })
    occurrences.push({
      id: 'occ1',
      inviteId: 'inv1',
      recurrenceId: DAY3,
      visible: true,
      status: 'pending',
    })

    expect(await isEventViewableBy('m1', PARTICIPANT)).toBe(false)
    // The granted occurrence itself is unaffected.
    expect(await isEventViewableBy(`m1_${DAY3}`, PARTICIPANT)).toBe(true)
  })

  it('refuses a participant asking for the master id even on a full baseline', async () => {
    // Even an unbounded baseline is not a licence to read the rule itself:
    // the response is expanded and filtered per occurrence everywhere else.
    seedInvite()
    expect(await isEventViewableBy('m1', PARTICIPANT)).toBe(false)
  })

  it('admits a participant asking for a plain invited event by its own id', async () => {
    // A non-recurring shared event has no occurrences to filter, so the
    // invite alone is the grant. This must keep working.
    seedInvite({ id: 'inv2', eventId: 'p1' })
    expect(await isEventViewableBy('p1', PARTICIPANT)).toBe(true)
  })

  it('treats a blank rrule as a plain event', async () => {
    events.push({ id: 'p2', userId: 'u1', rrule: '   ' })
    seedInvite({ id: 'inv3', eventId: 'p2' })
    expect(await isEventViewableBy('p2', PARTICIPANT)).toBe(true)
  })
})
