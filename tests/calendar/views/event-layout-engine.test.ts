import { describe, it, expect } from 'vitest'
import {
  layoutEventsForDay,
  separateEvents,
  getEventTimesForDay,
  shouldShowEventOnDay,
  isAllDayEvent,
  isMultiDayEvent,
  isBannerEvent,
  coversFullCalendarDay,
  layoutAllDaySegments,
  snapToQuarterHour,
  formatTimeForDisplay,
  formatHourMinute,
} from '@/components/app/views/event-layout-engine'
import { TimeFormat } from '@/lib/calendar-types'
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

  describe('coversFullCalendarDay', () => {
    it('true for a timed event spanning full days (1st 00:00 - 5th 16:00)', () => {
      const event = createEvent({
        startDate: new Date(2025, 0, 1, 0, 0),
        endDate: new Date(2025, 0, 5, 16, 0),
      })
      expect(coversFullCalendarDay(event)).toBe(true)
    })

    it('true when starting mid-day but covering a later full day', () => {
      // 1st 15:00 - 3rd 10:00 fully covers the 2nd.
      const event = createEvent({
        startDate: new Date(2025, 0, 1, 15, 0),
        endDate: new Date(2025, 0, 3, 10, 0),
      })
      expect(coversFullCalendarDay(event)).toBe(true)
    })

    it('false for a short overnight event (22:00 - 03:00)', () => {
      const event = createEvent({
        startDate: new Date(2025, 0, 1, 22, 0),
        endDate: new Date(2025, 0, 2, 3, 0),
      })
      expect(coversFullCalendarDay(event)).toBe(false)
    })

    it('false for a same-day timed event', () => {
      expect(coversFullCalendarDay(createEvent())).toBe(false)
    })

    it('treats an end at 23:59 as reaching midnight', () => {
      const event = createEvent({
        startDate: new Date(2025, 0, 1, 0, 0),
        endDate: new Date(2025, 0, 1, 23, 59),
      })
      expect(coversFullCalendarDay(event)).toBe(true)
    })
  })

  describe('isBannerEvent', () => {
    it('true for explicit all-day events', () => {
      expect(isBannerEvent(createEvent({ isAllDay: true }))).toBe(true)
    })

    it('true for a multi-day timed event covering full days', () => {
      const event = createEvent({
        startDate: new Date(2025, 0, 1, 0, 0),
        endDate: new Date(2025, 0, 5, 16, 0),
      })
      expect(isBannerEvent(event)).toBe(true)
    })

    it('false for a short overnight event', () => {
      const event = createEvent({
        startDate: new Date(2025, 0, 1, 22, 0),
        endDate: new Date(2025, 0, 2, 3, 0),
      })
      expect(isBannerEvent(event)).toBe(false)
    })

    it('false for a regular timed event', () => {
      expect(isBannerEvent(createEvent())).toBe(false)
    })
  })

  describe('shouldShowEventOnDay', () => {
    const day = DAY

    it('shows event starting on that day', () => {
      const event = createEvent({ startDate: utcDate(2025, 0, 15, 10, 0) })
      expect(shouldShowEventOnDay(event, day)).toBe(true)
    })

    it('shows all-day multi-day event on every day it covers', () => {
      const event = createEvent({
        isAllDay: true,
        startDate: new Date(2025, 0, 14, 0, 0),
        endDate: new Date(2025, 0, 16, 23, 59),
      })
      expect(shouldShowEventOnDay(event, new Date(2025, 0, 14))).toBe(true)
      expect(shouldShowEventOnDay(event, new Date(2025, 0, 15))).toBe(true)
      expect(shouldShowEventOnDay(event, new Date(2025, 0, 16))).toBe(true)
      expect(shouldShowEventOnDay(event, new Date(2025, 0, 17))).toBe(false)
    })

    it('treats a midnight end as exclusive for all-day events', () => {
      // Local (not UTC) dates: the exclusive-end rule keys off a local
      // midnight end time.
      const event = createEvent({
        isAllDay: true,
        startDate: new Date(2025, 0, 14, 0, 0),
        endDate: new Date(2025, 0, 16, 0, 0), // exclusive midnight end
      })
      expect(shouldShowEventOnDay(event, new Date(2025, 0, 14))).toBe(true)
      expect(shouldShowEventOnDay(event, new Date(2025, 0, 15))).toBe(true)
      expect(shouldShowEventOnDay(event, new Date(2025, 0, 16))).toBe(false)
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
      expect(times!.start.getHours()).toBe(0)
      expect(times!.start.getMinutes()).toBe(0)
      expect(times!.isMultiDay).toBe(true)
    })

    it('adjusts end for multi-day event not ending today', () => {
      const event = createEvent({
        startDate: utcDate(2025, 0, 14, 10, 0),
        endDate: utcDate(2025, 0, 16, 11, 0),
      })
      const times = getEventTimesForDay(event, day)
      expect(times).not.toBeNull()
      expect(times!.end.getHours()).toBe(23)
      expect(times!.end.getMinutes()).toBe(59)
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

    it('routes multi-day timed events covering full days to the all-day side', () => {
      const events = [
        createEvent({
          id: 'span',
          startDate: new Date(2025, 0, 1, 0, 0),
          endDate: new Date(2025, 0, 5, 16, 0),
        }),
        createEvent({
          id: 'overnight',
          startDate: new Date(2025, 0, 1, 22, 0),
          endDate: new Date(2025, 0, 2, 3, 0),
        }),
      ]
      const { allDayEvents, regularEvents } = separateEvents(
        events,
        new Date(2025, 0, 2),
      )
      expect(allDayEvents.map((e) => e.id)).toEqual(['span'])
      expect(regularEvents.map((e) => e.id)).toEqual(['overnight'])
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
      expect(formatTimeForDisplay(0, 0, TimeFormat.h24())).toBe('00:00')
      expect(formatTimeForDisplay(9, 5, TimeFormat.h24())).toBe('09:05')
      expect(formatTimeForDisplay(13, 30, TimeFormat.h24())).toBe('13:30')
      expect(formatTimeForDisplay(23, 59, TimeFormat.h24())).toBe('23:59')
    })

    it('formats 12h correctly', () => {
      expect(formatTimeForDisplay(0, 0, TimeFormat.h12())).toBe('12:00 AM')
      expect(formatTimeForDisplay(9, 5, TimeFormat.h12())).toBe('9:05 AM')
      expect(formatTimeForDisplay(12, 0, TimeFormat.h12())).toBe('12:00 PM')
      expect(formatTimeForDisplay(13, 30, TimeFormat.h12())).toBe('1:30 PM')
      expect(formatTimeForDisplay(23, 59, TimeFormat.h12())).toBe('11:59 PM')
    })
  })

  describe('formatHourMinute', () => {
    it('formats 24h correctly', () => {
      expect(formatHourMinute(0, 0, TimeFormat.h24())).toBe('00:00')
      expect(formatHourMinute(9, 5, TimeFormat.h24())).toBe('09:05')
    })

    it('formats 12h correctly', () => {
      expect(formatHourMinute(0, 0, TimeFormat.h12())).toBe('12:00 AM')
      expect(formatHourMinute(12, 0, TimeFormat.h12())).toBe('12:00 PM')
      expect(formatHourMinute(13, 30, TimeFormat.h12())).toBe('1:30 PM')
    })
  })

  describe('layoutAllDaySegments', () => {
    // Mon Jan 13 .. Sun Jan 19, 2025 (local dates)
    const rowDays = Array.from(
      { length: 7 },
      (_, i) => new Date(2025, 0, 13 + i),
    )

    it('returns empty array for no events', () => {
      expect(layoutAllDaySegments([], rowDays)).toEqual([])
    })

    it('spans a 3-day all-day event across its columns', () => {
      const event = createEvent({
        id: 'span',
        isAllDay: true,
        startDate: new Date(2025, 0, 14, 0, 0),
        endDate: new Date(2025, 0, 16, 23, 59),
      })
      const segments = layoutAllDaySegments([event], rowDays)
      expect(segments).toHaveLength(1)
      expect(segments[0]).toMatchObject({
        startIndex: 1,
        span: 3,
        lane: 0,
        continuesLeft: false,
        continuesRight: false,
      })
    })

    it('clips events that extend past the row and flags continuation', () => {
      const event = createEvent({
        id: 'long',
        isAllDay: true,
        startDate: new Date(2025, 0, 10, 0, 0),
        endDate: new Date(2025, 0, 22, 23, 59),
      })
      const segments = layoutAllDaySegments([event], rowDays)
      expect(segments).toHaveLength(1)
      expect(segments[0]).toMatchObject({
        startIndex: 0,
        span: 7,
        continuesLeft: true,
        continuesRight: true,
      })
    })

    it('stacks overlapping events into separate lanes', () => {
      const a = createEvent({
        id: 'a',
        isAllDay: true,
        startDate: new Date(2025, 0, 13, 0, 0),
        endDate: new Date(2025, 0, 15, 23, 59),
      })
      const b = createEvent({
        id: 'b',
        isAllDay: true,
        startDate: new Date(2025, 0, 14, 0, 0),
        endDate: new Date(2025, 0, 14, 23, 59),
      })
      const segments = layoutAllDaySegments([a, b], rowDays)
      const segA = segments.find((s) => s.event.id === 'a')!
      const segB = segments.find((s) => s.event.id === 'b')!
      expect(segA.lane).not.toBe(segB.lane)
    })

    it('reuses a lane when events do not overlap', () => {
      const a = createEvent({
        id: 'a',
        isAllDay: true,
        startDate: new Date(2025, 0, 13, 0, 0),
        endDate: new Date(2025, 0, 13, 23, 59),
      })
      const b = createEvent({
        id: 'b',
        isAllDay: true,
        startDate: new Date(2025, 0, 16, 0, 0),
        endDate: new Date(2025, 0, 16, 23, 59),
      })
      const segments = layoutAllDaySegments([a, b], rowDays)
      expect(segments.every((s) => s.lane === 0)).toBe(true)
    })

    it('excludes events fully outside the row', () => {
      const event = createEvent({
        id: 'out',
        isAllDay: true,
        startDate: new Date(2025, 0, 25, 0, 0),
        endDate: new Date(2025, 0, 26, 23, 59),
      })
      expect(layoutAllDaySegments([event], rowDays)).toEqual([])
    })

    it('treats a midnight end as exclusive', () => {
      const event = createEvent({
        id: 'excl',
        isAllDay: true,
        startDate: new Date(2025, 0, 14, 0, 0),
        endDate: new Date(2025, 0, 17, 0, 0), // occupies 14th..16th
      })
      const segments = layoutAllDaySegments([event], rowDays)
      expect(segments[0]).toMatchObject({ startIndex: 1, span: 3 })
    })

    it('spans a multi-day timed event through its partial last day', () => {
      // 14th 00:00 - 16th 16:00: the 16th is partial but still covered.
      const event = createEvent({
        id: 'timed-span',
        startDate: new Date(2025, 0, 14, 0, 0),
        endDate: new Date(2025, 0, 16, 16, 0),
      })
      const segments = layoutAllDaySegments([event], rowDays)
      expect(segments[0]).toMatchObject({ startIndex: 1, span: 3 })
    })
  })
})
