import { describe, it, expect } from 'vitest'
import { isJoinUrgent, meetingTiming } from '@/lib/meeting-timing'

const START = new Date('2026-08-26T14:00:00Z')
const END = new Date('2026-08-26T15:00:00Z')

function at(iso: string): number {
  return new Date(iso).getTime()
}

const timed = {
  startDate: START,
  endDate: END,
  isAllDay: false,
}

describe('meetingTiming', () => {
  it('is upcoming well before the start', () => {
    expect(meetingTiming(timed, at('2026-08-26T13:00:00Z'))).toBe('upcoming')
  })

  it('turns soon exactly ten minutes out', () => {
    expect(meetingTiming(timed, at('2026-08-26T13:50:00Z'))).toBe('soon')
  })

  it('is still upcoming one second before the ten-minute mark', () => {
    expect(meetingTiming(timed, at('2026-08-26T13:49:59Z'))).toBe('upcoming')
  })

  it('is live from the start instant', () => {
    expect(meetingTiming(timed, at('2026-08-26T14:00:00Z'))).toBe('live')
  })

  it('is live throughout', () => {
    expect(meetingTiming(timed, at('2026-08-26T14:30:00Z'))).toBe('live')
  })

  it('is live at the end instant, not past', () => {
    expect(meetingTiming(timed, at('2026-08-26T15:00:00Z'))).toBe('live')
  })

  it('is past after the end', () => {
    expect(meetingTiming(timed, at('2026-08-26T15:00:01Z'))).toBe('past')
  })

  it('never reports an all-day event as starting soon or live', () => {
    // "Starts in ten minutes" is meaningless for an all-day event, and calling
    // it live would make its Join button shout for 24 hours.
    const allDay = { startDate: START, endDate: END, isAllDay: true }
    expect(meetingTiming(allDay, at('2026-08-26T13:55:00Z'))).toBe('upcoming')
    expect(meetingTiming(allDay, at('2026-08-26T14:30:00Z'))).toBe('upcoming')
    expect(meetingTiming(allDay, at('2026-08-26T15:00:01Z'))).toBe('past')
  })

  it('falls back to upcoming on an unparseable date', () => {
    const broken = {
      startDate: new Date('nonsense'),
      endDate: END,
      isAllDay: false,
    }
    expect(meetingTiming(broken, at('2026-08-26T14:30:00Z'))).toBe('upcoming')
  })

  it('accepts ISO strings as well as Date objects', () => {
    const asStrings = {
      startDate: START.toISOString() as unknown as Date,
      endDate: END.toISOString() as unknown as Date,
      isAllDay: false,
    }
    expect(meetingTiming(asStrings, at('2026-08-26T14:30:00Z'))).toBe('live')
  })
})

describe('isJoinUrgent', () => {
  it('promotes the join action only when soon or live', () => {
    expect(isJoinUrgent('soon')).toBe(true)
    expect(isJoinUrgent('live')).toBe(true)
    expect(isJoinUrgent('upcoming')).toBe(false)
    expect(isJoinUrgent('past')).toBe(false)
  })
})
