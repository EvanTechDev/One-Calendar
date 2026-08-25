/**
 * The room's calendar context.
 *
 * The load-bearing case is a Series: its master row's `start_date` is the
 * recurrence anchor, which for a weekly standup is months in the past.
 * Presenting that as "this meeting's time" would be worse than showing no time
 * at all, so `isSeries` is what stops the room from claiming one.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { getEventContextForMeeting, meeting } from '@zntr/meetings'
import { readonlyCalendarEvents } from '@zntr/meetings/readonly-calendar'
import { createFakeDb } from './fake-db'

const fake = createFakeDb()
const db = fake.db

describe('getEventContextForMeeting', () => {
  beforeEach(() => {
    fake.reset()
  })

  it('returns null for an Instant Meeting with no event', async () => {
    fake.seed(meeting, [{ id: 'aaaa-1111', eventId: null }])
    expect(await getEventContextForMeeting(db, 'aaaa-1111')).toBeNull()
  })

  it('returns null when the meeting does not exist', async () => {
    expect(await getEventContextForMeeting(db, 'zzzz-9999')).toBeNull()
  })

  it('returns the title and times for a single event', async () => {
    const startDate = new Date('2026-08-26T14:00:00Z')
    const endDate = new Date('2026-08-26T15:00:00Z')
    fake.seed(meeting, [{ id: 'aaaa-1111', eventId: 'evt-1' }])
    fake.seed(readonlyCalendarEvents, [
      {
        id: 'evt-1',
        userId: 'user-1',
        title: 'Q3 budget review',
        startDate,
        endDate,
        rrule: null,
      },
    ])

    expect(await getEventContextForMeeting(db, 'aaaa-1111')).toEqual({
      eventId: 'evt-1',
      title: 'Q3 budget review',
      startDate,
      endDate,
      isSeries: false,
    })
  })

  it('flags a recurring event rather than reporting its anchor as a time', async () => {
    fake.seed(meeting, [{ id: 'bbbb-2222', eventId: 'evt-series' }])
    fake.seed(readonlyCalendarEvents, [
      {
        id: 'evt-series',
        userId: 'user-1',
        title: 'Weekly standup',
        startDate: new Date('2026-05-04T09:00:00Z'),
        endDate: new Date('2026-05-04T09:15:00Z'),
        rrule: 'FREQ=WEEKLY;BYDAY=MO',
      },
    ])

    const context = await getEventContextForMeeting(db, 'bbbb-2222')
    expect(context?.isSeries).toBe(true)
    expect(context?.title).toBe('Weekly standup')
  })

  it('treats a blank rrule as a single event', async () => {
    fake.seed(meeting, [{ id: 'cccc-3333', eventId: 'evt-blank' }])
    fake.seed(readonlyCalendarEvents, [
      {
        id: 'evt-blank',
        userId: 'user-1',
        title: 'One-off',
        startDate: new Date('2026-08-26T14:00:00Z'),
        endDate: new Date('2026-08-26T15:00:00Z'),
        rrule: '   ',
      },
    ])

    expect((await getEventContextForMeeting(db, 'cccc-3333'))?.isSeries).toBe(
      false,
    )
  })
})
