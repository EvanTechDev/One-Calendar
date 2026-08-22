// @vitest-environment node
/**
 * The MCP mirror of `tests/calendar/api/invite-rsvp-scope.test.ts`.
 *
 * MCP's `update_my_rsvp` had none of the endpoint's three guards, so the very
 * bug ADR-0012 was written for stayed reachable from the agent surface: a
 * stampless RSVP on a series wrote `event_invites.status`, the column
 * ADR-0012 declares meaningless for a series, and every occurrence stayed
 * "pending" while appearing to have been answered.
 *
 * It also validated against `getInviteByToken` — documented as returning only
 * the EARLIEST grant — so after a split it checked a tail stamp against
 * segment #1 and rejected a legitimate answer.
 *
 * Seam: `updateInviteRsvp` in lib/mcp/participant-tools.ts.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const store = vi.hoisted(() => ({
  invites: [] as Array<Record<string, unknown>>,
  occurrences: [] as Array<Record<string, unknown>>,
  events: [] as Array<Record<string, unknown>>,
  rsvpCalls: [] as Array<{ kind: 'invite' | 'occurrence'; payload: unknown }>,
}))

vi.mock('@/lib/invites/invite-service', () => ({
  getInvitesByToken: async (token: string) =>
    store.invites.filter((i) => i.inviteToken === token),
  getInviteByToken: async (token: string) =>
    store.invites.find((i) => i.inviteToken === token) ?? null,
  getInviteOccurrences: async (inviteId: string) =>
    store.occurrences
      .filter((o) => o.inviteId === inviteId)
      .map((o) => ({
        recurrenceId: o.recurrenceId as string,
        visible: o.visible as boolean,
        status: o.status as string,
      })),
  baselineOf: (row: Record<string, unknown>) => ({
    baselineKind: row.baselineKind === 'none' ? 'none' : 'all',
    fromStamp: (row.fromStamp ?? null) as string | null,
    untilStamp: (row.untilStamp ?? null) as string | null,
  }),
  // The two write paths. Which one fires is the whole point of these tests.
  updateRsvp: async (token: string, status: string) => {
    store.rsvpCalls.push({ kind: 'invite', payload: { token, status } })
  },
  updateOccurrenceRsvp: async (params: Record<string, unknown>) => {
    store.rsvpCalls.push({ kind: 'occurrence', payload: params })
  },
  getInvitesForEvent: async (eventId: string) =>
    store.invites.filter((i) => i.eventId === eventId),
  sendInviteEmails: async () => ({ sent: 0, failed: [] }),
  resendInviteEmail: async () => true,
  removeParticipantFromCalendar: async () => {},
}))

vi.mock('@/lib/drizzle/client', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: (pred: (r: Record<string, unknown>) => boolean) => {
          const rows = [...store.events].filter((r) => pred(r))
          return Object.assign(Promise.resolve(rows), {
            limit: () => Promise.resolve(rows.slice(0, 1)),
            orderBy: () => Promise.resolve(rows),
          })
        },
      }),
    }),
  }),
}))

function camel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq:
      (col: { name: string }, val: unknown) => (row: Record<string, unknown>) =>
        row[camel(col.name)] === val,
    and:
      (...ps: Array<(r: Record<string, unknown>) => boolean>) =>
      (row: Record<string, unknown>) =>
        ps.every((p) => p(row)),
  }
})

vi.mock('@/lib/api-helpers', () => ({
  decryptEvent: (e: unknown) => e,
}))

import { updateInviteRsvp } from '@/lib/mcp/participant-tools'
import { ParticipantError } from '@/lib/mcp/errors'

const MASTER = 'm-series'
const TAIL = 'm-tail'
const DAY1 = '20260822T110000Z'

function seedSeries() {
  store.events.push({
    id: MASTER,
    userId: 'organiser',
    title: 'Weekend sync',
    startDate: new Date('2026-08-22T11:00:00.000Z'),
    endDate: new Date('2026-08-22T11:30:00.000Z'),
    isAllDay: false,
    rrule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=SA,SU',
    exdate: null,
  })
  store.invites.push({
    id: 'inv1',
    eventId: MASTER,
    email: 'c@example.com',
    status: 'pending',
    inviteToken: 'tok',
    addedToCalendar: true,
    categoryId: null,
    baselineKind: 'all',
    fromStamp: null,
    untilStamp: null,
    expiresAt: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
  })
}

function seedPlainEvent() {
  store.events.push({
    id: 'plain',
    userId: 'organiser',
    title: 'One-off',
    startDate: new Date('2026-08-22T11:00:00.000Z'),
    endDate: new Date('2026-08-22T11:30:00.000Z'),
    isAllDay: false,
    rrule: null,
    exdate: null,
  })
  store.invites.push({
    id: 'inv2',
    eventId: 'plain',
    email: 'c@example.com',
    status: 'pending',
    inviteToken: 'tok2',
    addedToCalendar: true,
    categoryId: null,
    baselineKind: 'all',
    fromStamp: null,
    untilStamp: null,
    expiresAt: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
  })
}

beforeEach(() => {
  store.invites.length = 0
  store.occurrences.length = 0
  store.events.length = 0
  store.rsvpCalls.length = 0
})

async function refusal(promise: Promise<unknown>) {
  try {
    await promise
    return null
  } catch (error) {
    if (error instanceof ParticipantError) return error
    throw error
  }
}

describe('MCP RSVP on a recurring event', () => {
  it('records the answer against the given occurrence', async () => {
    seedSeries()
    const result = await updateInviteRsvp(
      'c@example.com',
      'tok',
      'accepted',
      DAY1,
    )

    expect(store.rsvpCalls).toHaveLength(1)
    expect(store.rsvpCalls[0].kind).toBe('occurrence')
    expect(store.rsvpCalls[0].payload).toMatchObject({
      inviteId: 'inv1',
      recurrenceId: DAY1,
      status: 'accepted',
    })
    expect(result).toMatchObject({ occurrence: DAY1, status: 'accepted' })
  })

  it('refuses a stampless answer, so an agent cannot answer every date at once', async () => {
    // THE BUG THE USER REPORTED, still reachable from MCP. The invite column is
    // meaningless for a series (ADR-0012), so this must be refused, not guessed.
    seedSeries()
    const error = await refusal(
      updateInviteRsvp('c@example.com', 'tok', 'accepted'),
    )

    expect(error).not.toBeNull()
    expect(error!.statusCode).toBe(400)
    expect(error!.message).toContain('recurrenceId')
    expect(store.rsvpCalls).toHaveLength(0)
  })

  it('refuses a stamp that is not a real occurrence of the series', async () => {
    // Tuesday: this is a Sat/Sun series, so the stamp is well-formed but bogus.
    // Without this an RSVP row is created for a date that does not exist, which
    // then renders as a phantom occurrence.
    seedSeries()
    const error = await refusal(
      updateInviteRsvp('c@example.com', 'tok', 'accepted', '20260825T110000Z'),
    )

    expect(error).not.toBeNull()
    expect(error!.statusCode).toBe(404)
    expect(store.rsvpCalls).toHaveLength(0)
  })

  it('refuses an occurrence the token does not grant', async () => {
    seedSeries()
    store.invites[0].baselineKind = 'none'
    const error = await refusal(
      updateInviteRsvp('c@example.com', 'tok', 'accepted', DAY1),
    )

    expect(error).not.toBeNull()
    expect(error!.statusCode).toBe(404)
    expect(store.rsvpCalls).toHaveLength(0)
  })

  it('accepts a tail stamp carried to a later segment after a split', async () => {
    // A split copies the grant to the new master keeping the token (ADR-0009),
    // so one token addresses several segments. Checking only the EARLIEST grant
    // — which is what getInviteByToken returns — rejects a legitimate answer to
    // the tail.
    seedSeries()
    // Segment #1 was truncated at 29 Aug; the tail lives on its own master.
    store.invites[0].untilStamp = '20260829T110000Z'
    store.events.push({
      id: TAIL,
      userId: 'organiser',
      title: 'Weekend sync',
      startDate: new Date('2026-08-29T11:00:00.000Z'),
      endDate: new Date('2026-08-29T11:30:00.000Z'),
      isAllDay: false,
      rrule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=SA,SU',
      exdate: null,
    })
    store.invites.push({
      id: 'inv1b',
      eventId: TAIL,
      email: 'c@example.com',
      status: 'pending',
      // The same token, deliberately.
      inviteToken: 'tok',
      addedToCalendar: true,
      categoryId: null,
      baselineKind: 'all',
      fromStamp: '20260829T110000Z',
      untilStamp: null,
      expiresAt: null,
      createdAt: new Date('2026-08-15T00:00:00.000Z'),
    })

    const tailStamp = '20260905T110000Z'
    await updateInviteRsvp('c@example.com', 'tok', 'declined', tailStamp)

    expect(store.rsvpCalls).toHaveLength(1)
    expect(store.rsvpCalls[0].payload).toMatchObject({
      // The TAIL segment's invite, not segment #1.
      inviteId: 'inv1b',
      recurrenceId: tailStamp,
      status: 'declined',
    })
  })

  it('still refuses a token that belongs to someone else', async () => {
    seedSeries()
    const error = await refusal(
      updateInviteRsvp('other@example.com', 'tok', 'accepted', DAY1),
    )

    expect(error).not.toBeNull()
    expect(error!.statusCode).toBe(403)
    expect(store.rsvpCalls).toHaveLength(0)
  })
})

describe('MCP RSVP on a non-recurring event', () => {
  it('records the answer on the invite row', async () => {
    seedPlainEvent()
    await updateInviteRsvp('c@example.com', 'tok2', 'accepted')

    expect(store.rsvpCalls).toHaveLength(1)
    expect(store.rsvpCalls[0].kind).toBe('invite')
  })

  it('refuses a stamp that cannot apply', async () => {
    seedPlainEvent()
    const error = await refusal(
      updateInviteRsvp('c@example.com', 'tok2', 'accepted', DAY1),
    )

    expect(error).not.toBeNull()
    expect(error!.statusCode).toBe(400)
    expect(store.rsvpCalls).toHaveLength(0)
  })
})
