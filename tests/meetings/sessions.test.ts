/**
 * The webhook session logic — the riskiest code in @zntr/meetings and, until
 * now, entirely untested (the calendar's route test mocks the package
 * wholesale).
 *
 * Four failures pinned here:
 *
 * 1. BUG-03 — `openSession` returned `MeetingSession` but could produce null
 *    through a `!`: when the row for a room sid existed but was already CLOSED,
 *    `getOpenSession` returned null, the insert conflicted so `returning()`
 *    gave `[]`, and the second lookup was null too. The webhook then read
 *    `session.id` off null, 500'd, and LiveKit retried the same undeliverable
 *    event forever — stalling ALL attendance recording.
 * 2. BUG-04a — sittings were keyed on "any open session for this meeting"
 *    rather than the room sid, so two distinct sittings merged. A room left
 *    idle overnight and rejoined counted the whole night as one meeting.
 * 3. BUG-04b — `room_finished` for an unknown sid did nothing, so when it
 *    overtook `room_started` the sitting opened later was never closed: its
 *    duration stayed null forever and the dashboard reported 0 min.
 * 4. BUG-04c — `endMeeting` relied solely on `deleteRoom` emitting
 *    `room_finished`, whose failure the caller swallows, so an ended meeting
 *    could keep a sitting open indefinitely.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  closeOpenAttendance,
  closeSession,
  closeSessionById,
  endMeeting,
  getOpenSession,
  getSession,
  meeting,
  meetingAttendance,
  meetingSession,
  openSession,
  recordJoin,
  recordLeave,
} from '@zntr/meetings'
import { createFakeDb } from './fake-db'

const fake = createFakeDb()
const db = fake.db

const MEETING = 'abcd-efgh'
const SID_A = 'RM_first_sitting'
const SID_B = 'RM_second_sitting'

const T = (iso: string) => new Date(iso)

beforeEach(() => {
  fake.reset()
  fake.seed(meeting, [{ id: MEETING, organiserId: 'user-1' }])
})

describe('openSession identity (BUG-04a)', () => {
  it('is idempotent for a repeated delivery of the same sid', async () => {
    const first = await openSession(db, {
      id: SID_A,
      meetingId: MEETING,
      startedAt: T('2026-03-01T09:00:00Z'),
    })
    const retry = await openSession(db, {
      id: SID_A,
      meetingId: MEETING,
      // A retry may carry a slightly different timestamp; the row must not move.
      startedAt: T('2026-03-01T09:00:05Z'),
    })

    expect(first?.id).toBe(SID_A)
    expect(retry?.id).toBe(SID_A)
    expect(retry?.startedAt).toEqual(T('2026-03-01T09:00:00Z'))
    expect(fake.all(meetingSession)).toHaveLength(1)
  })

  it('opens a SECOND sitting rather than adopting a stale open one', async () => {
    // The overnight case: a sitting whose room_finished never arrived.
    await openSession(db, {
      id: SID_A,
      meetingId: MEETING,
      startedAt: T('2026-03-01T22:00:00Z'),
    })

    const morning = await openSession(db, {
      id: SID_B,
      meetingId: MEETING,
      startedAt: T('2026-03-02T09:00:00Z'),
    })

    expect(morning?.id).toBe(SID_B)
    expect(morning?.startedAt).toEqual(T('2026-03-02T09:00:00Z'))
    expect(fake.all(meetingSession)).toHaveLength(2)
  })
})

describe('openSession on an already-closed sid (BUG-03)', () => {
  it('returns null instead of laundering it through a non-null assertion', async () => {
    await openSession(db, {
      id: SID_A,
      meetingId: MEETING,
      startedAt: T('2026-03-01T09:00:00Z'),
    })
    await closeSessionById(db, {
      id: SID_A,
      meetingId: MEETING,
      endedAt: T('2026-03-01T10:00:00Z'),
    })

    // A late duplicate of room_started / participant_joined for a finished
    // sitting. This is the exact input that produced a TypeError → 500 →
    // infinite LiveKit retry.
    const late = await openSession(db, {
      id: SID_A,
      meetingId: MEETING,
      startedAt: T('2026-03-01T09:00:00Z'),
    })

    expect(late).toBeNull()
    // And it must NOT reopen the finished sitting.
    expect((await getSession(db, SID_A))?.endedAt).toEqual(
      T('2026-03-01T10:00:00Z'),
    )
    expect(fake.all(meetingSession)).toHaveLength(1)
  })
})

describe('out-of-order webhook delivery (BUG-04b)', () => {
  it('self-heals when room_finished arrives before room_started', async () => {
    // room_finished first, for a sid nothing has opened.
    const closed = await closeSessionById(db, {
      id: SID_A,
      meetingId: MEETING,
      endedAt: T('2026-03-01T10:00:00Z'),
    })
    expect(closed?.endedAt).toEqual(T('2026-03-01T10:00:00Z'))

    // The late room_started must not resurrect it as an open sitting, which is
    // what left durations null forever.
    const late = await openSession(db, {
      id: SID_A,
      meetingId: MEETING,
      startedAt: T('2026-03-01T09:00:00Z'),
    })
    expect(late).toBeNull()

    const rows = fake.all(meetingSession)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.endedAt).not.toBeNull()
    // No sitting is left open for this meeting.
    expect(await getOpenSession(db, MEETING)).toBeNull()
  })

  it('closing an already-closed sid is idempotent and keeps the first end time', async () => {
    await closeSessionById(db, {
      id: SID_A,
      meetingId: MEETING,
      endedAt: T('2026-03-01T10:00:00Z'),
    })
    const again = await closeSessionById(db, {
      id: SID_A,
      meetingId: MEETING,
      endedAt: T('2026-03-01T11:00:00Z'),
    })
    expect(again?.endedAt).toEqual(T('2026-03-01T10:00:00Z'))
  })
})

describe('attendance', () => {
  it('records one row per participant per sitting, ignoring duplicate joins', async () => {
    const session = await openSession(db, {
      id: SID_A,
      meetingId: MEETING,
      startedAt: T('2026-03-01T09:00:00Z'),
    })
    for (let i = 0; i < 3; i++) {
      await recordJoin(db, {
        sessionId: session!.id,
        participantIdentity: 'user_1',
        participantName: 'Ada',
        joinedAt: T('2026-03-01T09:01:00Z'),
      })
    }
    expect(fake.all(meetingAttendance)).toHaveLength(1)
  })

  it('separates the same participant across two sittings', async () => {
    const first = await openSession(db, {
      id: SID_A,
      meetingId: MEETING,
      startedAt: T('2026-03-01T09:00:00Z'),
    })
    await recordJoin(db, {
      sessionId: first!.id,
      participantIdentity: 'user_1',
      participantName: 'Ada',
      joinedAt: T('2026-03-01T09:01:00Z'),
    })
    await recordLeave(db, {
      sessionId: first!.id,
      participantIdentity: 'user_1',
      leftAt: T('2026-03-01T09:30:00Z'),
    })
    await closeSessionById(db, {
      id: SID_A,
      meetingId: MEETING,
      endedAt: T('2026-03-01T09:30:00Z'),
    })

    const second = await openSession(db, {
      id: SID_B,
      meetingId: MEETING,
      startedAt: T('2026-03-02T09:00:00Z'),
    })
    await recordJoin(db, {
      sessionId: second!.id,
      participantIdentity: 'user_1',
      participantName: 'Ada',
      joinedAt: T('2026-03-02T09:01:00Z'),
    })

    expect(fake.all(meetingAttendance)).toHaveLength(2)
  })

  it('closes anyone still present when the sitting ends', async () => {
    const session = await openSession(db, {
      id: SID_A,
      meetingId: MEETING,
      startedAt: T('2026-03-01T09:00:00Z'),
    })
    for (const identity of ['user_1', 'user_2']) {
      await recordJoin(db, {
        sessionId: session!.id,
        participantIdentity: identity,
        participantName: identity,
        joinedAt: T('2026-03-01T09:01:00Z'),
      })
    }
    await closeOpenAttendance(db, session!.id, T('2026-03-01T10:00:00Z'))

    for (const row of fake.all(meetingAttendance)) {
      expect(row.leftAt).toEqual(T('2026-03-01T10:00:00Z'))
    }
  })
})

describe('endMeeting closes the sitting itself (BUG-04c)', () => {
  it('does not depend on the room_finished webhook arriving', async () => {
    const session = await openSession(db, {
      id: SID_A,
      meetingId: MEETING,
      startedAt: T('2026-03-01T09:00:00Z'),
    })
    await recordJoin(db, {
      sessionId: session!.id,
      participantIdentity: 'user_1',
      participantName: 'Ada',
      joinedAt: T('2026-03-01T09:01:00Z'),
    })

    // deleteRoom's failure is swallowed by the caller, so room_finished may
    // never fire. The duration must still be recorded.
    await endMeeting(db, MEETING)

    expect(await getOpenSession(db, MEETING)).toBeNull()
    expect(fake.all(meetingSession)[0]!.endedAt).not.toBeNull()
    expect(fake.all(meetingAttendance)[0]!.leftAt).not.toBeNull()
    expect(fake.all(meeting)[0]!.endedAt).not.toBeNull()
  })

  it('is safe when the meeting has no open sitting', async () => {
    await expect(endMeeting(db, MEETING)).resolves.toBeUndefined()
    expect(fake.all(meeting)[0]!.endedAt).not.toBeNull()
  })
})

describe('closeSession by meeting', () => {
  it('returns null when nothing is open', async () => {
    expect(await closeSession(db, MEETING, new Date())).toBeNull()
  })
})
