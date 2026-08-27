// @vitest-environment node
/**
 * A participant's RSVP must be per-occurrence everywhere, not just on the invite
 * page.
 *
 * Reported symptom: after answering several dates on the invite page and adding
 * the series to their calendar, every occurrence in the participant's own
 * calendar still shows "pending" (tentative), and answering from there does not
 * stick to the occurrence being viewed.
 *
 * Seam: `getSharedEvents` via `GET /api/events` — the payload the participant's
 * calendar renders from. That is the public boundary where the symptom is
 * observable, and it is where the per-occurrence RSVP has to arrive.
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
  getAuthedUser: async () => ({ id: 'participant', email: 'c@example.com' }),
  decryptEvent: (e: unknown) => e,
}))

vi.mock('@/lib/field-crypto', () => ({
  encryptField: (_id: string, v: unknown) => v,
  encryptJsonField: (_id: string, v: unknown) => v,
  decryptField: (_id: string, v: unknown) => v,
  decryptFieldStrict: (_id: string, v: unknown) => v,
  looksLikeEnvelope: () => true,
}))

vi.mock('@/lib/cache/events', () => ({
  getCachedEvents: async () => null,
  setCachedEvents: async () => {},
  invalidateEventCache: async () => {},
  groupByMonth: () => new Map(),
}))

vi.mock('@/lib/cache/keys', () => ({
  fullMonthRange: () => ({ start: new Date(0), end: new Date(0) }),
}))

import { GET } from '@/app/api/events/route'

const fake = getFakeDb()
const MASTER = 'm-series'
const DAY1 = '20260822T110000Z'
const DAY2 = '20260823T110000Z'

/** A weekly Sat/Sun series owned by the organiser, shared with the participant. */
function seedSharedSeries() {
  fake.seed({
    id: MASTER,
    userId: 'organiser',
    title: 'Weekend sync',
    description: null,
    location: null,
    startDate: new Date('2026-08-22T11:00:00.000Z'),
    endDate: new Date('2026-08-22T11:30:00.000Z'),
    isAllDay: false,
    status: 'confirmed',
    color: null,
    categoryId: null,
    participants: null,
    notificationMinutes: null,
    emailReminder: false,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    rrule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=SA,SU',
    exdate: null,
    seriesId: null,
    recurrenceId: null,
  })

  fake.seed(
    { id: 'organiser', email: 'o@example.com', name: 'Org', image: null },
    'user',
  )
  fake.seed(
    { id: 'participant', email: 'c@example.com', name: 'C', image: null },
    'user',
  )

  fake.seed(
    {
      id: 'inv1',
      eventId: MASTER,
      email: 'c@example.com',
      // Invite-level status is deliberately WRONG for the occurrences below.
      // If it leaks through, the participant sees this instead of their answer.
      status: 'declined',
      inviteToken: 'tok',
      emailSent: true,
      addedToCalendar: true,
      categoryId: null,
      baselineKind: 'all',
      fromStamp: null,
      untilStamp: null,
      expiresAt: null,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    },
    'event_invites',
  )
}

function seedOccurrenceRsvp(stamp: string, status: string) {
  fake.seed(
    {
      id: `occ-${stamp}`,
      inviteId: 'inv1',
      recurrenceId: stamp,
      visible: true,
      status,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    },
    'event_invite_occurrences',
  )
}

async function sharedInstances() {
  const res = await GET(new NextRequest('http://localhost/api/events?tz=UTC'))
  expect(res.status).toBe(200)
  const body = (await res.json()) as {
    events: Array<Record<string, unknown>>
  }
  return body.events.filter((e) => e.viewOnly === true)
}

/**
 * The participant's own RSVP as the client reads it: their entry in `invites[]`.
 * `enrichEventsWithInvites` resolves this per occurrence, so this is the
 * contract the calendar UI must honour.
 */
function ownRsvp(instance: Record<string, unknown>): string | undefined {
  const invites = instance.invites as
    | Array<{ email: string; status: string }>
    | undefined
  return invites?.find((i) => i.email === 'c@example.com')?.status
}

beforeEach(() => {
  fake.reset()
})

describe("a participant's own calendar", () => {
  it('reports each occurrence with its own RSVP', async () => {
    seedSharedSeries()
    seedOccurrenceRsvp(DAY1, 'accepted')
    seedOccurrenceRsvp(DAY2, 'maybe')

    const instances = await sharedInstances()
    const byStamp = new Map(instances.map((i) => [i.recurrenceId as string, i]))

    expect(ownRsvp(byStamp.get(DAY1)!)).toBe('accepted')
    expect(ownRsvp(byStamp.get(DAY2)!)).toBe('maybe')
  })

  it('reports pending for an occurrence never answered', async () => {
    seedSharedSeries()
    seedOccurrenceRsvp(DAY1, 'accepted')

    const instances = await sharedInstances()
    const unanswered = instances.find(
      (i) => i.recurrenceId !== DAY1 && i.recurrenceId !== undefined,
    )

    expect(ownRsvp(unanswered!)).toBe('pending')
  })

  it('never leaks the invite-level status onto an occurrence', async () => {
    // The invite row says "declined". No occurrence should inherit that.
    seedSharedSeries()
    seedOccurrenceRsvp(DAY1, 'accepted')

    const instances = await sharedInstances()
    const answered = instances.find((i) => i.recurrenceId === DAY1)

    expect(ownRsvp(answered!)).not.toBe('declined')
    expect(ownRsvp(answered!)).toBe('accepted')
  })
})
