// @vitest-environment node
/**
 * `list_my_event_invites` reported `rsvp_status: invite.status` — the column
 * ADR-0012 (an RSVP must name the occurrence it answers) declares meaningless
 * for a series. A participant who had answered several occurrences saw one
 * series-wide value, usually "pending", with no way to tell what they had said
 * about any date.
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

import { listMyEventInvites } from '@/lib/mcp/participant-tools'

const fake = getFakeDb()

const DAY1 = '20260822T110000Z'
const DAY2 = '20260823T110000Z'

function seedSeries() {
  fake.seed({
    id: 'm1',
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
    seriesId: null,
    recurrenceId: null,
  })
  fake.seed(
    {
      id: 'inv1',
      eventId: 'm1',
      email: 'c@example.com',
      // Deliberately non-pending: the meaningless column must not be reported.
      status: 'accepted',
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

function seedPlainEvent() {
  fake.seed({
    id: 'plain',
    userId: 'organiser',
    title: 'One-off',
    description: null,
    location: null,
    startDate: new Date('2026-09-22T11:00:00.000Z'),
    endDate: new Date('2026-09-22T11:30:00.000Z'),
    isAllDay: false,
    color: null,
    categoryId: null,
    rrule: null,
    exdate: null,
    seriesId: null,
    recurrenceId: null,
  })
  fake.seed(
    {
      id: 'inv2',
      eventId: 'plain',
      email: 'c@example.com',
      status: 'declined',
      inviteToken: 'tok2',
      emailSent: true,
      addedToCalendar: true,
      categoryId: null,
      baselineKind: 'all',
      fromStamp: null,
      untilStamp: null,
      expiresAt: null,
      createdAt: new Date('2026-08-02T00:00:00.000Z'),
      updatedAt: new Date('2026-08-02T00:00:00.000Z'),
    },
    'event_invites',
  )
}

beforeEach(() => {
  fake.reset()
})

describe('listMyEventInvites reports RSVPs per occurrence', () => {
  it('reports each answered occurrence and no series-wide status', async () => {
    seedSeries()
    fake.seed(
      {
        id: 'occ1',
        inviteId: 'inv1',
        recurrenceId: DAY1,
        visible: true,
        status: 'accepted',
        createdAt: new Date('2026-08-03T00:00:00.000Z'),
        updatedAt: new Date('2026-08-03T00:00:00.000Z'),
      },
      'event_invite_occurrences',
    )
    fake.seed(
      {
        id: 'occ2',
        inviteId: 'inv1',
        recurrenceId: DAY2,
        visible: true,
        status: 'declined',
        createdAt: new Date('2026-08-03T00:00:00.000Z'),
        updatedAt: new Date('2026-08-03T00:00:00.000Z'),
      },
      'event_invite_occurrences',
    )

    const { invites } = await listMyEventInvites('c@example.com')
    expect(invites).toHaveLength(1)
    const entry = invites[0]

    expect(entry.recurring).toBe(true)
    // The invite column is meaningless for a series, so it must not be passed
    // off as the answer.
    expect(entry.rsvp_status).toBeNull()
    expect(entry.occurrence_rsvps).toEqual([
      { recurrence_id: DAY1, rsvp_status: 'accepted' },
      { recurrence_id: DAY2, rsvp_status: 'declined' },
    ])
  })

  it('reports an unanswered series as recurring with no answers', async () => {
    seedSeries()

    const { invites } = await listMyEventInvites('c@example.com')
    expect(invites[0].recurring).toBe(true)
    expect(invites[0].rsvp_status).toBeNull()
    expect(invites[0].occurrence_rsvps).toEqual([])
  })

  it('keeps reporting the invite column for a non-recurring event', async () => {
    // `event_invites.status` is meaningful exactly here, so this must not change.
    seedPlainEvent()

    const { invites } = await listMyEventInvites('c@example.com')
    expect(invites[0].recurring).toBe(false)
    expect(invites[0].rsvp_status).toBe('declined')
    expect(invites[0].occurrence_rsvps).toBeNull()
  })
})
