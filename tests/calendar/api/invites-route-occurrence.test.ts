// @vitest-environment node
/**
 * `GET /api/invites?eventId=<instanceId>` is the organiser's polled participant
 * list — `event-preview.tsx` refreshes it every 15 seconds and REPLACES the
 * correctly-filtered `event.invites` with whatever this returns.
 *
 * It spread every invite of the series wholesale, so 15 seconds after an
 * organiser removed a participant at `single` scope that participant reappeared
 * on the occurrence, and every occurrence listed the whole series' participants
 * showing `event_invites.status` — the column ADR-0012 declares meaningless for
 * a series, so real per-occurrence answers rendered as "pending".
 *
 * The other organiser-facing reader (`enrichEventsWithInvites`) already filters
 * by stamp and already uses `rsvpForOccurrence`; see
 * ADR-0008 (visibility is decided in one place, shared by every reader).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const store = vi.hoisted(() => ({
  invites: [] as Array<Record<string, unknown>>,
  occurrences: [] as Array<Record<string, unknown>>,
  events: [] as Array<Record<string, unknown>>,
  users: [] as Array<Record<string, unknown>>,
}))

vi.mock('@/lib/api-helpers', () => ({
  getAuthedUser: async () => ({ id: 'organiser', email: 'o@example.com' }),
  decryptEvent: (e: unknown) => e,
}))

vi.mock('@/lib/invites/invite-service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/invites/invite-service')>()
  return {
    ...actual,
    getInvitesForEvent: async (eventId: string) =>
      store.invites.filter((i) => i.eventId === eventId),
    getOccurrencesForInvites: async (inviteIds: string[]) => {
      const byInvite = new Map<string, unknown[]>()
      for (const row of store.occurrences) {
        if (!inviteIds.includes(row.inviteId as string)) continue
        const list = byInvite.get(row.inviteId as string) ?? []
        list.push({
          recurrenceId: row.recurrenceId,
          visible: row.visible,
          status: row.status,
        })
        byInvite.set(row.inviteId as string, list)
      }
      return byInvite
    },
    sendInviteEmails: async () => ({ sent: 0, failed: [] }),
    removeParticipantFromCalendar: async () => {},
  }
})

vi.mock('@/lib/invites/scoped-invites', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/invites/scoped-invites')>()
  return {
    ...actual,
    resolveParticipantTarget: async (eventId: string) => {
      const separator = eventId.lastIndexOf('_')
      const seriesId = separator > 0 ? eventId.slice(0, separator) : eventId
      const stamp = separator > 0 ? eventId.slice(separator + 1) : null
      const master = store.events.find((e) => e.id === seriesId)
      if (!master) return null
      return { masterId: seriesId, master, stamp, firstStamp: DAY1 }
    },
  }
})

vi.mock('@/lib/drizzle/client', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: (pred: (r: Record<string, unknown>) => boolean) => {
          const rows = [...store.users].filter((r) => pred(r))
          return Object.assign(Promise.resolve(rows), {
            limit: () => Promise.resolve(rows.slice(0, 1)),
          })
        },
      }),
    }),
  }),
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq:
      (col: { name: string }, val: unknown) => (row: Record<string, unknown>) =>
        row[col.name] === val,
    and:
      (...ps: Array<(r: Record<string, unknown>) => boolean>) =>
      (row: Record<string, unknown>) =>
        ps.every((p) => p(row)),
    inArray:
      (col: { name: string }, vals: unknown[]) =>
      (row: Record<string, unknown>) =>
        vals.includes(row[col.name]),
  }
})

vi.mock('@/lib/field-crypto', () => ({
  decryptField: (_id: string, v: unknown) => v,
}))

vi.mock('@/lib/rate-limit', () => ({
  checkFixedWindowLimit: async () => ({ allowed: true, retryAfter: 0 }),
  rateLimitedResponse: () => new Response(null, { status: 429 }),
}))

import { GET } from '@/app/api/invites/route'

const MASTER = 'm1'
const DAY1 = '20260822T110000Z'
const DAY2 = '20260823T110000Z'

function seedInvite(
  id: string,
  email: string,
  overrides: Record<string, unknown> = {},
) {
  store.invites.push({
    id,
    eventId: MASTER,
    email,
    status: 'pending',
    inviteToken: `tok-${id}`,
    emailSent: true,
    addedToCalendar: true,
    categoryId: null,
    baselineKind: 'all',
    fromStamp: null,
    untilStamp: null,
    expiresAt: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  })
}

beforeEach(() => {
  store.invites.length = 0
  store.occurrences.length = 0
  store.events.length = 0
  store.users.length = 0
  store.events.push({
    id: MASTER,
    userId: 'organiser',
    rrule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=SA,SU',
    exdate: null,
    isAllDay: false,
    startDate: new Date('2026-08-22T11:00:00.000Z'),
  })
})

async function get(eventId: string) {
  const res = await GET(
    new NextRequest(
      `http://localhost/api/invites?eventId=${encodeURIComponent(eventId)}`,
    ),
  )
  return { status: res.status, body: await res.json() }
}

describe('GET /api/invites for one occurrence', () => {
  it('omits a participant hidden at that occurrence', async () => {
    // THE REGRESSION. `b` was removed at `single` scope from DAY1 only, so the
    // organiser's list for DAY1 must not show them — and 15 seconds later the
    // poll must not put them back.
    seedInvite('a', 'a@example.com')
    seedInvite('b', 'b@example.com')
    store.occurrences.push({
      id: 'occ1',
      inviteId: 'b',
      recurrenceId: DAY1,
      visible: false,
      status: 'pending',
    })

    const { status, body } = await get(`${MASTER}_${DAY1}`)
    expect(status).toBe(200)
    expect(body.invites.map((i: { email: string }) => i.email)).toEqual([
      'a@example.com',
    ])

    // Still present on the occurrence they were not removed from.
    const other = await get(`${MASTER}_${DAY2}`)
    expect(
      other.body.invites.map((i: { email: string }) => i.email).sort(),
    ).toEqual(['a@example.com', 'b@example.com'])
  })

  it('reports the per-occurrence RSVP, not the invite column', async () => {
    // `event_invites.status` is meaningless for a series (ADR-0012), so taking
    // it here made every real answer render as "pending".
    seedInvite('a', 'a@example.com', { status: 'accepted' })
    store.occurrences.push({
      id: 'occ1',
      inviteId: 'a',
      recurrenceId: DAY1,
      visible: true,
      status: 'declined',
    })

    const { body } = await get(`${MASTER}_${DAY1}`)
    expect(body.invites[0].status).toBe('declined')

    // An unanswered occurrence is 'pending', not the invite column's value.
    const other = await get(`${MASTER}_${DAY2}`)
    expect(other.body.invites[0].status).toBe('pending')
  })

  it('omits a participant whose grant does not reach the occurrence', async () => {
    seedInvite('a', 'a@example.com')
    seedInvite('b', 'b@example.com', { baselineKind: 'none' })

    const { body } = await get(`${MASTER}_${DAY1}`)
    expect(body.invites.map((i: { email: string }) => i.email)).toEqual([
      'a@example.com',
    ])
  })

  it('keeps an expired invite in the list and flags it', async () => {
    // Expiry ends the emailed link, not the grant (ADR-0013). The organiser
    // needs to SEE the dead-link participant to resend — dropping the row hid
    // exactly the person who needed attention.
    seedInvite('a', 'a@example.com')
    seedInvite('b', 'b@example.com', {
      addedToCalendar: false,
      expiresAt: new Date(Date.now() - 1000),
    })

    const { body } = await get(`${MASTER}_${DAY1}`)
    const byEmail = Object.fromEntries(
      body.invites.map((i: { email: string; inviteExpired: boolean }) => [
        i.email,
        i.inviteExpired,
      ]),
    )
    expect(byEmail).toEqual({
      'a@example.com': false,
      'b@example.com': true,
    })
  })

  it('does not flag an expired link once the participant joined', async () => {
    // `addedToCalendar` is the permanent grant; the link's state is then
    // irrelevant (ADR-0013).
    seedInvite('a', 'a@example.com', {
      expiresAt: new Date(Date.now() - 1000),
    })

    const { body } = await get(`${MASTER}_${DAY1}`)
    expect(body.invites).toHaveLength(1)
    expect(body.invites[0].inviteExpired).toBe(false)
  })

  it('reports the invite column for a non-recurring event', async () => {
    // A plain event has no stamp, so every invite applies and its own status is
    // the answer. This must keep working.
    store.events.push({
      id: 'plain',
      userId: 'organiser',
      rrule: null,
      exdate: null,
      isAllDay: false,
      startDate: new Date('2026-08-22T11:00:00.000Z'),
    })
    seedInvite('a', 'a@example.com', {
      eventId: 'plain',
      status: 'accepted',
    })

    const { body } = await get('plain')
    expect(body.invites).toHaveLength(1)
    expect(body.invites[0].status).toBe('accepted')
  })
})
