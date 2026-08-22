// @vitest-environment node
/**
 * `PATCH /api/invite/:token` must record an RSVP against the occurrence it was
 * given, and must not silently fall back to a series-wide answer.
 *
 * Reported symptom: answering from inside the participant's own calendar left
 * every occurrence showing "pending". The client omitted `recurrenceId`, so the
 * write landed on the invite row instead of `event_invite_occurrences` — and the
 * calendar reads the per-occurrence value, which never changed.
 *
 * Seam: the public invite endpoint. This is where "which occurrence am I
 * answering?" is decided, so it is where the rule belongs.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

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
  addParticipantToCalendar: async () => {},
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

vi.mock('@/lib/field-crypto', () => ({
  decryptField: (_id: string, v: unknown) => v,
}))

vi.mock('@/lib/rate-limit', () => ({
  checkFixedWindowLimit: async () => ({ allowed: true, retryAfter: 0 }),
  clientIpFrom: () => '127.0.0.1',
  rateLimitedResponse: () => new Response(null, { status: 429 }),
}))

import { PATCH } from '@/app/api/invite/[token]/route'

const MASTER = 'm-series'
const DAY1 = '20260822T110000Z'
const DAY2 = '20260823T110000Z'

function seedSeries() {
  store.events.push({
    id: MASTER,
    userId: 'organiser',
    title: 'Weekend sync',
    description: null,
    location: null,
    startDate: new Date('2026-08-22T11:00:00.000Z'),
    endDate: new Date('2026-08-22T11:30:00.000Z'),
    isAllDay: false,
    color: null,
    categoryId: null,
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
    description: null,
    location: null,
    startDate: new Date('2026-08-22T11:00:00.000Z'),
    endDate: new Date('2026-08-22T11:30:00.000Z'),
    isAllDay: false,
    color: null,
    categoryId: null,
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

async function patch(token: string, body: Record<string, unknown>) {
  return PATCH(
    new NextRequest(`http://localhost/api/invite/${token}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ token }) },
  )
}

beforeEach(() => {
  store.invites.length = 0
  store.occurrences.length = 0
  store.events.length = 0
  store.rsvpCalls.length = 0
})

describe('RSVP on a recurring event', () => {
  it('records the answer against the given occurrence', async () => {
    seedSeries()
    const res = await patch('tok', { status: 'accepted', recurrenceId: DAY1 })

    expect(res.status).toBe(200)
    expect(store.rsvpCalls).toHaveLength(1)
    expect(store.rsvpCalls[0].kind).toBe('occurrence')
    expect(store.rsvpCalls[0].payload).toMatchObject({
      inviteId: 'inv1',
      recurrenceId: DAY1,
      status: 'accepted',
    })
  })

  it('keeps two occurrences independent', async () => {
    seedSeries()
    await patch('tok', { status: 'accepted', recurrenceId: DAY1 })
    await patch('tok', { status: 'declined', recurrenceId: DAY2 })

    const stamps = store.rsvpCalls.map(
      (c) => (c.payload as { recurrenceId: string }).recurrenceId,
    )
    expect(stamps).toEqual([DAY1, DAY2])
    expect(store.rsvpCalls.every((c) => c.kind === 'occurrence')).toBe(true)
  })

  it('refuses a series-wide answer, so a client cannot answer every date at once', async () => {
    // THE BUG. The calendar UI omitted recurrenceId; the write then landed on
    // the invite row, which the calendar does not read — so the answer appeared
    // to vanish and every occurrence stayed pending. A recurring event has no
    // meaningful series-wide RSVP, so this must be refused rather than guessed.
    seedSeries()
    const res = await patch('tok', { status: 'accepted' })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: expect.stringContaining('recurrenceId'),
    })
    expect(store.rsvpCalls).toHaveLength(0)
  })

  it('refuses an occurrence the token does not grant', async () => {
    seedSeries()
    store.invites[0].baselineKind = 'none'
    const res = await patch('tok', { status: 'accepted', recurrenceId: DAY1 })

    expect(res.status).toBe(404)
    expect(store.rsvpCalls).toHaveLength(0)
  })

  it('refuses a stamp that is not a real occurrence of the series', async () => {
    // Tuesday: this is a Sat/Sun series, so the stamp is well-formed but bogus.
    seedSeries()
    const res = await patch('tok', {
      status: 'accepted',
      recurrenceId: '20260825T110000Z',
    })

    expect(res.status).toBe(404)
    expect(store.rsvpCalls).toHaveLength(0)
  })
})

describe('RSVP on a non-recurring event', () => {
  it('records the answer on the invite row', async () => {
    seedPlainEvent()
    const res = await patch('tok2', { status: 'accepted' })

    expect(res.status).toBe(200)
    expect(store.rsvpCalls).toHaveLength(1)
    expect(store.rsvpCalls[0].kind).toBe('invite')
  })

  it('ignores a stamp that cannot apply', async () => {
    seedPlainEvent()
    const res = await patch('tok2', { status: 'accepted', recurrenceId: DAY1 })

    expect(res.status).toBe(400)
    expect(store.rsvpCalls).toHaveLength(0)
  })
})
