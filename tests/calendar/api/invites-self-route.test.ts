// @vitest-environment node
/**
 * `PATCH /api/invites/self` — a participant acting on their own grant from
 * inside the calendar, authenticated by session rather than by the emailed
 * token. The token in the body only NAMES the invite; expiry must not apply,
 * because the grant outlives the link — see ADR-0013 (the invite link expires;
 * the grant does not).
 *
 * Reported symptom this closes: RSVPing or re-categorising from the calendar
 * went through the public token endpoint, so both silently died 7 days after
 * the invite email.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const store = vi.hoisted(() => ({
  invites: [] as Array<Record<string, unknown>>,
  occurrences: [] as Array<Record<string, unknown>>,
  events: [] as Array<Record<string, unknown>>,
  categories: [] as Array<Record<string, unknown>>,
  rsvpCalls: [] as Array<{ kind: 'invite' | 'occurrence'; payload: unknown }>,
  addToCalendarCalls: [] as Array<{ token: string; categoryId: unknown }>,
  authedUser: null as { id: string; email: string } | null,
}))

vi.mock('@/lib/api-helpers', () => ({
  getAuthedUser: async () => store.authedUser,
}))

vi.mock('@/lib/invites/invite-service', () => ({
  // Grant semantics by contract: no expiry filter (ADR-0013).
  getGrantsByToken: async (token: string) =>
    store.invites.filter((i) => i.inviteToken === token),
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
  updateRsvp: async (token: string, status: string) => {
    store.rsvpCalls.push({ kind: 'invite', payload: { token, status } })
  },
  updateOccurrenceRsvp: async (params: Record<string, unknown>) => {
    store.rsvpCalls.push({ kind: 'occurrence', payload: params })
  },
  addParticipantToCalendar: async (token: string, categoryId: unknown) => {
    store.addToCalendarCalls.push({ token, categoryId })
  },
}))

vi.mock('@/lib/drizzle/client', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: (pred: (r: Record<string, unknown>) => boolean) => {
          // Both the categories check (this route) and the series expansion
          // (rsvp-target) select here; distinguish rows by their fields.
          const rows = [...store.events, ...store.categories].filter((r) =>
            pred(r),
          )
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

import { PATCH } from '@/app/api/invites/self/route'

const MASTER = 'm-series'
const DAY1 = '20260822T110000Z'
const EXPIRED = new Date(Date.now() - 24 * 3600 * 1000)

function seedSeries(inviteOverrides: Record<string, unknown> = {}) {
  store.events.push({
    id: MASTER,
    userId: 'organiser',
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
    ...inviteOverrides,
  })
}

async function patch(body: Record<string, unknown>) {
  return PATCH(
    new NextRequest('http://localhost/api/invites/self', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

beforeEach(() => {
  store.invites.length = 0
  store.occurrences.length = 0
  store.events.length = 0
  store.categories.length = 0
  store.rsvpCalls.length = 0
  store.addToCalendarCalls.length = 0
  store.authedUser = { id: 'participant', email: 'c@example.com' }
})

describe('authentication', () => {
  it('refuses an anonymous caller', async () => {
    store.authedUser = null
    seedSeries()
    const res = await patch({
      inviteToken: 'tok',
      status: 'accepted',
      recurrenceId: DAY1,
    })
    expect(res.status).toBe(401)
    expect(store.rsvpCalls).toHaveLength(0)
  })

  it("refuses a session that does not match the invite's email", async () => {
    // The session is the credential here; holding a token addressed to
    // someone else grants nothing.
    store.authedUser = { id: 'intruder', email: 'x@example.com' }
    seedSeries()
    const res = await patch({
      inviteToken: 'tok',
      status: 'accepted',
      recurrenceId: DAY1,
    })
    expect(res.status).toBe(403)
    expect(store.rsvpCalls).toHaveLength(0)
  })

  it('matches emails case-insensitively', async () => {
    store.authedUser = { id: 'participant', email: 'C@Example.com' }
    seedSeries()
    const res = await patch({
      inviteToken: 'tok',
      status: 'accepted',
      recurrenceId: DAY1,
    })
    expect(res.status).toBe(200)
  })
})

describe('link expiry does not apply (ADR-0013)', () => {
  it('accepts an RSVP through a long-expired token', async () => {
    // THE POINT of this endpoint: the emailed link died weeks ago, but the
    // signed-in participant still holds the grant.
    seedSeries({ expiresAt: EXPIRED })
    const res = await patch({
      inviteToken: 'tok',
      status: 'accepted',
      recurrenceId: DAY1,
    })
    expect(res.status).toBe(200)
    expect(store.rsvpCalls).toHaveLength(1)
    expect(store.rsvpCalls[0]).toMatchObject({
      kind: 'occurrence',
      payload: { inviteId: 'inv1', recurrenceId: DAY1, status: 'accepted' },
    })
  })

  it('accepts a category change through a long-expired token', async () => {
    seedSeries({ expiresAt: EXPIRED })
    store.categories.push({ id: 'cat1', userId: 'participant' })
    const res = await patch({ inviteToken: 'tok', categoryId: 'cat1' })
    expect(res.status).toBe(200)
    expect(store.addToCalendarCalls).toEqual([
      { token: 'tok', categoryId: 'cat1' },
    ])
  })
})

describe('RSVP scope rules are shared (ADR-0012)', () => {
  it('refuses a stampless answer to a recurring event', async () => {
    seedSeries()
    const res = await patch({ inviteToken: 'tok', status: 'accepted' })
    expect(res.status).toBe(400)
    expect(store.rsvpCalls).toHaveLength(0)
  })

  it('refuses an occurrence outside the grant', async () => {
    seedSeries({ baselineKind: 'none' })
    const res = await patch({
      inviteToken: 'tok',
      status: 'accepted',
      recurrenceId: DAY1,
    })
    expect(res.status).toBe(404)
    expect(store.rsvpCalls).toHaveLength(0)
  })
})

describe('category changes', () => {
  it('refuses a category the participant does not own', async () => {
    seedSeries()
    store.categories.push({ id: 'cat1', userId: 'someone-else' })
    const res = await patch({ inviteToken: 'tok', categoryId: 'cat1' })
    expect(res.status).toBe(404)
    expect(store.addToCalendarCalls).toHaveLength(0)
  })

  it('files under no category via the sentinel', async () => {
    seedSeries()
    const res = await patch({
      inviteToken: 'tok',
      categoryId: '__uncategorized__',
    })
    expect(res.status).toBe(200)
    expect(store.addToCalendarCalls).toEqual([
      { token: 'tok', categoryId: null },
    ])
  })
})

describe('input validation', () => {
  it('refuses a body with neither status nor categoryId', async () => {
    seedSeries()
    const res = await patch({ inviteToken: 'tok' })
    expect(res.status).toBe(400)
  })

  it('404s an unknown token', async () => {
    const res = await patch({ inviteToken: 'nope', status: 'accepted' })
    expect(res.status).toBe(404)
  })
})
