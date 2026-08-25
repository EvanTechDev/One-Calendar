/**
 * The dashboard aggregation and search. Previously untested despite being the
 * largest body of SQL in the package.
 *
 * Pinned here:
 *
 * - `getMeetingSummaries` with a STILL-OPEN sitting: an unfinished meeting has
 *   no duration yet, so it must contribute attendees and zero minutes rather
 *   than a number that changes on every refresh.
 * - The fan-out found while writing these tests: aggregating duration over a
 *   left-joined attendance table multiplied each sitting's length by its
 *   attendee count, so a 60-minute call with three people reported 180 minutes.
 * - SEC-06: an unescaped LIKE term meant a query of `%` matched every meeting
 *   the user owns, and `_` matched any character.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  getEventTitlesForMeetings,
  getMeetingSummaries,
  meeting,
  meetingAttendance,
  meetingChatMessage,
  meetingSession,
  searchMeetings,
} from '@zntr/meetings'
import { readonlyCalendarEvents } from '@zntr/meetings/readonly-calendar'
import { createFakeDb } from './fake-db'

const fake = createFakeDb()
const db = fake.db
const OWNER = 'user-1'
const STRANGER = 'user-2'
const T = (iso: string) => new Date(iso)

beforeEach(() => {
  fake.reset()
})

describe('getMeetingSummaries', () => {
  it('returns nothing for no ids', async () => {
    expect(await getMeetingSummaries(db, [])).toEqual({})
  })

  it('counts a closed sitting once, not once per attendee', async () => {
    fake.seed(meeting, [{ id: 'aaaa-0001', organiserId: OWNER }])
    fake.seed(meetingSession, [
      {
        id: 's1',
        meetingId: 'aaaa-0001',
        startedAt: T('2026-03-01T09:00:00Z'),
        endedAt: T('2026-03-01T10:00:00Z'),
      },
    ])
    fake.seed(
      meetingAttendance,
      ['ada', 'grace', 'alan'].map((name, index) => ({
        id: `a${index}`,
        sessionId: 's1',
        participantIdentity: name,
        participantName: name,
        joinedAt: T('2026-03-01T09:05:00Z'),
        leftAt: T('2026-03-01T10:00:00Z'),
      })),
    )

    const summaries = await getMeetingSummaries(db, ['aaaa-0001'])
    // 60 minutes, NOT 180.
    expect(summaries['aaaa-0001']).toEqual({ totalMinutes: 60, attendees: 3 })
  })

  it('reports an open sitting as attendees with no duration', async () => {
    fake.seed(meeting, [{ id: 'aaaa-0002', organiserId: OWNER }])
    fake.seed(meetingSession, [
      {
        id: 's-open',
        meetingId: 'aaaa-0002',
        startedAt: T('2026-03-01T09:00:00Z'),
        endedAt: null,
      },
    ])
    fake.seed(meetingAttendance, [
      {
        id: 'a1',
        sessionId: 's-open',
        participantIdentity: 'ada',
        participantName: 'Ada',
        joinedAt: T('2026-03-01T09:05:00Z'),
        leftAt: null,
      },
    ])

    expect(await getMeetingSummaries(db, ['aaaa-0002'])).toEqual({
      'aaaa-0002': { totalMinutes: 0, attendees: 1 },
    })
  })

  it('sums closed sittings and ignores the open one alongside them', async () => {
    fake.seed(meeting, [{ id: 'aaaa-0003', organiserId: OWNER }])
    fake.seed(meetingSession, [
      {
        id: 's1',
        meetingId: 'aaaa-0003',
        startedAt: T('2026-03-01T09:00:00Z'),
        endedAt: T('2026-03-01T09:30:00Z'),
      },
      {
        id: 's2',
        meetingId: 'aaaa-0003',
        startedAt: T('2026-03-02T09:00:00Z'),
        endedAt: T('2026-03-02T09:15:00Z'),
      },
      {
        id: 's3',
        meetingId: 'aaaa-0003',
        startedAt: T('2026-03-03T09:00:00Z'),
        endedAt: null,
      },
    ])
    // The same person across two sittings is one distinct attendee.
    fake.seed(meetingAttendance, [
      {
        id: 'a1',
        sessionId: 's1',
        participantIdentity: 'ada',
        participantName: 'Ada',
        joinedAt: T('2026-03-01T09:00:00Z'),
        leftAt: T('2026-03-01T09:30:00Z'),
      },
      {
        id: 'a2',
        sessionId: 's2',
        participantIdentity: 'ada',
        participantName: 'Ada',
        joinedAt: T('2026-03-02T09:00:00Z'),
        leftAt: T('2026-03-02T09:15:00Z'),
      },
    ])

    expect(await getMeetingSummaries(db, ['aaaa-0003'])).toEqual({
      'aaaa-0003': { totalMinutes: 45, attendees: 1 },
    })
  })

  it('omits meetings with no sittings at all', async () => {
    fake.seed(meeting, [{ id: 'aaaa-0004', organiserId: OWNER }])
    expect(await getMeetingSummaries(db, ['aaaa-0004'])).toEqual({})
  })
})

describe('searchMeetings LIKE escaping (SEC-06)', () => {
  beforeEach(() => {
    fake.seed(meeting, [
      { id: 'abcd-0001', organiserId: OWNER },
      { id: 'wxyz-0002', organiserId: OWNER },
      { id: 'abcd-9999', organiserId: STRANGER },
    ])
    fake.seed(meetingChatMessage, [
      {
        id: 'c1',
        meetingId: 'wxyz-0002',
        senderIdentity: 'ada',
        senderName: 'Ada',
        message: 'discount is 50% off',
        sentAt: T('2026-03-01T09:00:00Z'),
      },
    ])
  })

  it('finds a meeting by its room code', async () => {
    const found = await searchMeetings(db, OWNER, 'abcd')
    expect(found.map((row) => row.id)).toEqual(['abcd-0001'])
  })

  it('never returns another user\u2019s meetings', async () => {
    const found = await searchMeetings(db, OWNER, 'abcd-9999')
    expect(found).toEqual([])
  })

  it('treats a bare % as a literal, not "match everything"', async () => {
    const found = await searchMeetings(db, OWNER, '%')
    // Only the chat message actually containing a percent sign.
    expect(found.map((row) => row.id)).toEqual(['wxyz-0002'])
  })

  it('treats _ as a literal, not "any character"', async () => {
    // `abcd_0001` would match `abcd-0001` if the underscore were a wildcard.
    expect(await searchMeetings(db, OWNER, 'abcd_0001')).toEqual([])
  })

  it('returns nothing for an empty query', async () => {
    expect(await searchMeetings(db, OWNER, '   ')).toEqual([])
  })

  it('matches retained chat text', async () => {
    const found = await searchMeetings(db, OWNER, 'discount')
    expect(found.map((row) => row.id)).toEqual(['wxyz-0002'])
  })
})

describe('getEventTitlesForMeetings', () => {
  it('maps meeting ids to their linked event title', async () => {
    fake.seed(meeting, [
      { id: 'abcd-0001', organiserId: OWNER, eventId: 'evt-1' },
      { id: 'wxyz-0002', organiserId: OWNER, eventId: null },
    ])
    fake.seed(readonlyCalendarEvents, [
      {
        id: 'evt-1',
        userId: OWNER,
        title: 'Weekly standup',
        startDate: T('2026-03-01T09:00:00Z'),
        endDate: T('2026-03-01T09:30:00Z'),
      },
    ])

    expect(
      await getEventTitlesForMeetings(db, ['abcd-0001', 'wxyz-0002']),
    ).toEqual({ 'abcd-0001': 'Weekly standup' })
  })

  it('returns nothing for no ids', async () => {
    expect(await getEventTitlesForMeetings(db, [])).toEqual({})
  })
})
