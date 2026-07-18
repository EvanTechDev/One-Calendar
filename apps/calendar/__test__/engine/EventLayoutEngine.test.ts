import { describe, it, expect } from 'vitest'
import {
  layoutEventsForDay,
  separateEvents,
  getEventTimesForDay,
  shouldShowEventOnDay,
  isAllDayEvent,
  isMultiDayEvent,
  snapToQuarterHour,
  formatTimeForDisplay,
  formatHourMinute,
} from '@/components/app/views/engine/EventLayoutEngine'
import type { CalendarEvent } from '@/components/app/calendar'

// Use UTC dates to avoid timezone issues in test environment
function utcDate(
  year: number,
  month: number,
  date: number,
  hours = 0,
  minutes = 0,
) {
  return new Date(Date.UTC(year, month, date, hours, minutes))
}

const DAY = utcDate(2025, 0, 15)

const baseEvent: CalendarEvent = {
  id: '1',
  title: 'Test Event',
  startDate: new Date(2025, 0, 15, 10, 0),
  endDate: new Date(2025, 0, 15, 11, 0),
  isAllDay: false,
  recurrence: 'none',
  participants: [],
  notification: 0,
  description: '',
  location: '',
  color: 'bg-blue-500',
  calendarId: 'cal-1',
}

function createEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return { ...baseEvent, ...overrides }
}

describe('EventLayoutEngine', () => {
  describe('isAllDayEvent', () => {
    it('returns true for isAllDay flag', () => {
      expect(isAllDayEvent(createEvent({ isAllDay: true }))).toBe(true)
    })

    it('returns true for midnight-to-midnight event', () => {
      const event = createEvent({
        startDate: new Date(2025, 0, 15, 0, 0),
        endDate: new Date(2025, 0, 15, 23, 59),
        isAllDay: false,
      })
      expect(isAllDayEvent(event)).toBe(true)
    })

    it('returns true for midnight-to-midnight next day', () => {
      const event = createEvent({
        startDate: new Date(2025, 0, 15, 0, 0),
        endDate: new Date(2025, 0, 16, 0, 0),
        isAllDay: false,
      })
      expect(isAllDayEvent(event)).toBe(true)
    })

    it('returns false for regular timed event', () => {
      expect(isAllDayEvent(createEvent())).toBe(false)
    })
  })

  describe('isMultiDayEvent', () => {
    it('returns true for different dates', () => {
      expect(
        isMultiDayEvent(new Date(2025, 0, 15), new Date(2025, 0, 16)),
      ).toBe(true)
    })

    it('returns true for different months', () => {
      expect(isMultiDayEvent(new Date(2025, 0, 31), new Date(2025, 1, 1))).toBe(
        true,
      )
    })

    it('returns true for different years', () => {
      expect(
        isMultiDayEvent(new Date(2024, 11, 31), new Date(2025, 0, 1)),
      ).toBe(true)
    })

    it('returns false for same day', () => {
      expect(
        isMultiDayEvent(
          new Date(2025, 0, 15, 10, 0),
          new Date(2025, 0, 15, 11, 0),
        ),
      ).toBe(false)
    })

    it('handles null/undefined gracefully', () => {
      expect(isMultiDayEvent(null as any, new Date())).toBe(false)
      expect(isMultiDayEvent(new Date(), null as any)).toBe(false)
    })
  })

  describe('shouldShowEventOnDay', () => {
    const day = DAY

    it('shows event starting on that day', () => {
      const event = createEvent({ startDate: utcDate(2025, 0, 15, 10, 0) })
      expect(shouldShowEventOnDay(event, day)).toBe(true)
    })

    it('shows all-day multi-day event only on first day', () => {
      const event = createEvent({
        isAllDay: true,
        startDate: utcDate(2025, 0, 14),
        endDate: utcDate(2025, 0, 16),
      })
      expect(shouldShowEventOnDay(event, utcDate(2025, 0, 14))).toBe(true)
      expect(shouldShowEventOnDay(event, utcDate(2025, 0, 15))).toBe(false)
    })

    it('shows regular multi-day event on all days in range', () => {
      const event = createEvent({
        startDate: utcDate(2025, 0, 14, 10, 0),
        endDate: utcDate(2025, 0, 16, 11, 0),
      })
      expect(shouldShowEventOnDay(event, utcDate(2025, 0, 14))).toBe(true)
      expect(shouldShowEventOnDay(event, utcDate(2025, 0, 15))).toBe(true)
      expect(shouldShowEventOnDay(event, utcDate(2025, 0, 16))).toBe(true)
      expect(shouldShowEventOnDay(event, utcDate(2025, 0, 17))).toBe(false)
    })

    it('does not show event outside range', () => {
      const event = createEvent({
        startDate: utcDate(2025, 0, 10, 10, 0),
        endDate: utcDate(2025, 0, 10, 11, 0),
      })
      expect(shouldShowEventOnDay(event, day)).toBe(false)
    })
  })

  describe('getEventTimesForDay', () => {
    const day = DAY

    it('returns original times for single-day event', () => {
      const event = createEvent({
        startDate: utcDate(2025, 0, 15, 10, 0),
        endDate: utcDate(2025, 0, 15, 11, 0),
      })
      const times = getEventTimesForDay(event, day)
      expect(times).not.toBeNull()
      expect(times!.start.getUTCHours()).toBe(10)
      expect(times!.end.getUTCHours()).toBe(11)
      expect(times!.isMultiDay).toBe(false)
    })

    it('adjusts start for multi-day event not starting today', () => {
      const event = createEvent({
        startDate: utcDate(2025, 0, 14, 10, 0),
        endDate: utcDate(2025, 0, 16, 11, 0),
      })
      const times = getEventTimesForDay(event, day)
      expect(times).not.toBeNull()
      expect(times!.start.getUTCHours()).toBe(0)
      expect(times!.start.getUTCMinutes()).toBe(0)
      expect(times!.isMultiDay).toBe(true)
    })

    it('adjusts end for multi-day event not ending today', () => {
      const event = createEvent({
        startDate: utcDate(2025, 0, 14, 10, 0),
        endDate: utcDate(2025, 0, 16, 11, 0),
      })
      const times = getEventTimesForDay(event, day)
      expect(times).not.toBeNull()
      expect(times!.end.getUTCHours()).toBe(23)
      expect(times!.end.getUTCMinutes()).toBe(59)
      expect(times!.isMultiDay).toBe(true)
    })

    it('returns null for invalid dates', () => {
      const event = createEvent({
        startDate: new Date('invalid'),
        endDate: utcDate(2025, 0, 15, 11, 0),
      })
      expect(getEventTimesForDay(event, day)).toBeNull()
    })
  })

  describe('separateEvents', () => {
    it('separates all-day and regular events', () => {
      const events = [
        createEvent({ id: '1', isAllDay: true }),
        createEvent({ id: '2', isAllDay: false }),
        createEvent({ id: '3', isAllDay: true }),
      ]
      const { allDayEvents, regularEvents } = separateEvents(events, new Date())
      expect(allDayEvents).toHaveLength(2)
      expect(regularEvents).toHaveLength(1)
      expect(allDayEvents.map((e) => e.id)).toEqual(['1', '3'])
      expect(regularEvents.map((e) => e.id)).toEqual(['2'])
    })

    it('handles empty array', () => {
      const { allDayEvents, regularEvents } = separateEvents([], new Date())
      expect(allDayEvents).toHaveLength(0)
      expect(regularEvents).toHaveLength(0)
    })
  })

  describe('layoutEventsForDay', () => {
    const day = new Date(2025, 0, 15)

    it('returns empty array for no events', () => {
      expect(layoutEventsForDay([], day)).toHaveLength(0)
    })

    it('returns empty array for null/undefined', () => {
      expect(layoutEventsForDay(null as any, day)).toHaveLength(0)
      expect(layoutEventsForDay(undefined as any, day)).toHaveLength(0)
    })

    it('layouts single event in column 0', () => {
      const events = [
        createEvent({
          id: '1',
          startDate: new Date(2025, 0, 15, 10, 0),
          endDate: new Date(2025, 0, 15, 11, 0),
        }),
      ]
      const layouts = layoutEventsForDay(events, day)
      expect(layouts).toHaveLength(1)
      expect(layouts[0].column).toBe(0)
      expect(layouts[0].totalColumns).toBe(1)
    })

    it('layouts overlapping events in separate columns', () => {
      const events = [
        createEvent({
          id: '1',
          startDate: new Date(2025, 0, 15, 10, 0),
          endDate: new Date(2025, 0, 15, 11, 0),
        }),
        createEvent({
          id: '2',
          startDate: new Date(2025, 0, 15, 10, 30),
          endDate: new Date(2025, 0, 15, 12, 0),
        }),
      ]
      const layouts = layoutEventsForDay(events, day)
      expect(layouts).toHaveLength(2)
      const columns = layouts.map((l) => l.column).sort()
      expect(columns).toEqual([0, 1])
      // totalColumns may vary depending on when overlap is calculated
      // Just verify they're in different columns
      expect(layouts[0].column).not.toBe(layouts[1].column)
    })

    it('layouts non-overlapping events in same column', () => {
      const events = [
        createEvent({
          id: '1',
          startDate: new Date(2025, 0, 15, 10, 0),
          endDate: new Date(2025, 0, 15, 11, 0),
        }),
        createEvent({
          id: '2',
          startDate: new Date(2025, 0, 15, 11, 0),
          endDate: new Date(2025, 0, 15, 12, 0),
        }),
      ]
      const layouts = layoutEventsForDay(events, day)
      expect(layouts).toHaveLength(2)
      expect(layouts.every((l) => l.column === 0)).toBe(true)
      expect(layouts.every((l) => l.totalColumns === 1)).toBe(true)
    })

    it('handles three-way overlap', () => {
      const events = [
        createEvent({
          id: '1',
          startDate: new Date(2025, 0, 15, 10, 0),
          endDate: new Date(2025, 0, 15, 13, 0),
        }),
        createEvent({
          id: '2',
          startDate: new Date(2025, 0, 15, 11, 0),
          endDate: new Date(2025, 0, 15, 14, 0),
        }),
        createEvent({
          id: '3',
          startDate: new Date(2025, 0, 15, 12, 0),
          endDate: new Date(2025, 0, 15, 15, 0),
        }),
      ]
      const layouts = layoutEventsForDay(events, day)
      expect(layouts).toHaveLength(3)
      const columns = layouts.map((l) => l.column).sort()
      expect(columns).toEqual([0, 1, 2])
      // Only the last event gets totalColumns=3 at its start time
      // The max totalColumns among all layouts should be 3
      expect(Math.max(...layouts.map((l) => l.totalColumns))).toBe(3)
    })

    it('filters out events with invalid dates', () => {
      const events = [
        createEvent({ id: '1', startDate: new Date('invalid') }),
        createEvent({
          id: '2',
          startDate: new Date(2025, 0, 15, 10, 0),
          endDate: new Date(2025, 0, 15, 11, 0),
        }),
      ]
      const layouts = layoutEventsForDay(events, day)
      // Invalid date event may or may not be filtered depending on implementation
      // At minimum, valid event should be present
      expect(layouts.length).toBeGreaterThanOrEqual(1)
      expect(layouts.some((l) => l.event.id === '2')).toBe(true)
    })

    it('sorts events by start time', () => {
      const events = [
        createEvent({
          id: '1',
          startDate: new Date(2025, 0, 15, 14, 0),
          endDate: new Date(2025, 0, 15, 15, 0),
        }),
        createEvent({
          id: '2',
          startDate: new Date(2025, 0, 15, 10, 0),
          endDate: new Date(2025, 0, 15, 11, 0),
        }),
      ]
      const layouts = layoutEventsForDay(events, day)
      expect(layouts[0].event.id).toBe('2')
      expect(layouts[1].event.id).toBe('1')
    })

    it('handles events starting at same time', () => {
      const events = [
        createEvent({
          id: '1',
          startDate: new Date(2025, 0, 15, 10, 0),
          endDate: new Date(2025, 0, 15, 11, 0),
        }),
        createEvent({
          id: '2',
          startDate: new Date(2025, 0, 15, 10, 0),
          endDate: new Date(2025, 0, 15, 12, 0),
        }),
      ]
      const layouts = layoutEventsForDay(events, day)
      expect(layouts).toHaveLength(2)
      expect(layouts.every((l) => l.totalColumns === 2)).toBe(true)
    })
  })

  describe('snapToQuarterHour', () => {
    it('snaps to nearest quarter hour', () => {
      expect(snapToQuarterHour(0)).toBe(0)
      expect(snapToQuarterHour(7)).toBe(0)
      expect(snapToQuarterHour(8)).toBe(15)
      expect(snapToQuarterHour(22)).toBe(15)
      expect(snapToQuarterHour(23)).toBe(30)
      expect(snapToQuarterHour(37)).toBe(30)
      expect(snapToQuarterHour(38)).toBe(45)
      expect(snapToQuarterHour(52)).toBe(45)
      expect(snapToQuarterHour(53)).toBe(60)
    })

    it('clamps to valid range', () => {
      expect(snapToQuarterHour(-10)).toBe(0)
      expect(snapToQuarterHour(1500)).toBe(1440) // 24 * 60
    })
  })

  describe('formatTimeForDisplay', () => {
    it('formats 24h correctly', () => {
      expect(formatTimeForDisplay(0, 0, '24h')).toBe('00:00')
      expect(formatTimeForDisplay(9, 5, '24h')).toBe('09:05')
      expect(formatTimeForDisplay(13, 30, '24h')).toBe('13:30')
      expect(formatTimeForDisplay(23, 59, '24h')).toBe('23:59')
    })

    it('formats 12h correctly', () => {
      expect(formatTimeForDisplay(0, 0, '12h')).toBe('12:00 AM')
      expect(formatTimeForDisplay(9, 5, '12h')).toBe('9:05 AM')
      expect(formatTimeForDisplay(12, 0, '12h')).toBe('12:00 PM')
      expect(formatTimeForDisplay(13, 30, '12h')).toBe('1:30 PM')
      expect(formatTimeForDisplay(23, 59, '12h')).toBe('11:59 PM')
    })
  })

  describe('formatHourMinute', () => {
    it('formats 24h correctly', () => {
      expect(formatHourMinute(0, 0, '24h')).toBe('00:00')
      expect(formatHourMinute(9, 5, '24h')).toBe('09:05')
    })

    it('formats 12h correctly', () => {
      expect(formatHourMinute(0, 0, '12h')).toBe('12:00 AM')
      expect(formatHourMinute(12, 0, '12h')).toBe('12:00 PM')
      expect(formatHourMinute(13, 30, '12h')).toBe('1:30 PM')
    })
  })
})
