import { describe, it, expect } from 'vitest'
import {
  expandRecurringEvent,
  getAllEventsInRange,
} from '@/components/app/lib/recurrence'
import type { CalendarEvent } from '@/components/app/calendar'

const baseEvent = {
  id: '1',
  title: 'Test Event',
  startDate: new Date(2025, 0, 15, 10, 0),
  endDate: new Date(2025, 0, 15, 11, 0),
  isAllDay: false,
  recurrence: 'none' as const,
  location: '',
  participants: [],
  notification: 0,
  description: '',
  color: 'bg-blue-500',
  calendarId: 'cal-1',
}

function createEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    ...baseEvent,
    ...overrides,
  }
}

describe('Recurrence Engine', () => {
  describe('expandRecurringEvent', () => {
    it('returns empty for non-recurring', () => {
      const event = createEvent({ recurrence: 'none' })
      const rangeStart = new Date(2025, 0, 1)
      const rangeEnd = new Date(2025, 0, 31)

      const occurrences = expandRecurringEvent(event, rangeStart, rangeEnd)
      expect(occurrences).toHaveLength(0)
    })

    it('returns empty for non-recurring outside range', () => {
      const event = createEvent({
        startDate: new Date(2025, 1, 15, 10, 0),
        endDate: new Date(2025, 1, 15, 11, 0),
        recurrence: 'none',
      })
      const rangeStart = new Date(2025, 0, 1)
      const rangeEnd = new Date(2025, 0, 31)

      const occurrences = expandRecurringEvent(event, rangeStart, rangeEnd)
      expect(occurrences).toHaveLength(0)
    })

    it('expands daily recurring event', () => {
      const event = createEvent({
        startDate: new Date(2025, 0, 15, 10, 0),
        endDate: new Date(2025, 0, 15, 11, 0),
        recurrence: 'daily',
      })
      const rangeStart = new Date(2025, 0, 15)
      const rangeEnd = new Date(2025, 0, 17)

      const occurrences = expandRecurringEvent(event, rangeStart, rangeEnd)
      // rangeEnd is Jan 17 00:00, so Jan 15 and 16 are included (Jan 17 10:00 > Jan 17 00:00)
      expect(occurrences.length).toBeGreaterThanOrEqual(2)
      expect(occurrences[0].isRecurrence).toBe(false)
      if (occurrences.length > 1) {
        expect(occurrences[1].isRecurrence).toBe(true)
      }
    })

    it('expands weekly recurring event', () => {
      const event = createEvent({
        startDate: new Date(2025, 0, 15, 10, 0),
        endDate: new Date(2025, 0, 15, 11, 0),
        recurrence: 'weekly',
      })
      const rangeStart = new Date(2025, 0, 1)
      const rangeEnd = new Date(2025, 1, 1)

      const occurrences = expandRecurringEvent(event, rangeStart, rangeEnd)
      // rangeEnd is Feb 1 00:00, so Jan 15, 22, 29 are included (Feb 5 > Feb 1)
      expect(occurrences.length).toBeGreaterThanOrEqual(3)
      expect(occurrences[0].isRecurrence).toBe(false)
    })

    it('expands monthly recurring event', () => {
      const event = createEvent({
        startDate: new Date(2025, 0, 15, 10, 0),
        endDate: new Date(2025, 0, 15, 11, 0),
        recurrence: 'monthly',
      })
      const rangeStart = new Date(2025, 0, 1)
      const rangeEnd = new Date(2025, 11, 31)

      const occurrences = expandRecurringEvent(event, rangeStart, rangeEnd)
      expect(occurrences.length).toBeGreaterThanOrEqual(12)
    })

    it('expands yearly recurring event', () => {
      const event = createEvent({
        startDate: new Date(2025, 0, 15, 10, 0),
        endDate: new Date(2025, 0, 15, 11, 0),
        recurrence: 'yearly',
      })
      const rangeStart = new Date(2025, 0, 1)
      const rangeEnd = new Date(2027, 11, 31)

      const occurrences = expandRecurringEvent(event, rangeStart, rangeEnd)
      expect(occurrences.length).toBeGreaterThanOrEqual(3)
    })

    it('respects maxOccurrences limit', () => {
      const event = createEvent({
        startDate: new Date(2025, 0, 15, 10, 0),
        endDate: new Date(2025, 0, 15, 11, 0),
        recurrence: 'daily',
      })
      const rangeStart = new Date(2025, 0, 1)
      const rangeEnd = new Date(2025, 11, 31)

      const occurrences = expandRecurringEvent(event, rangeStart, rangeEnd, 5)
      expect(occurrences.length).toBeLessThanOrEqual(5)
    })

    it('preserves duration for recurring occurrences', () => {
      const event = createEvent({
        startDate: new Date(2025, 0, 15, 10, 0),
        endDate: new Date(2025, 0, 15, 12, 30), // 2.5 hours
        recurrence: 'daily',
      })
      const rangeStart = new Date(2025, 0, 15)
      const rangeEnd = new Date(2025, 0, 17)

      const occurrences = expandRecurringEvent(event, rangeStart, rangeEnd)
      for (const occ of occurrences) {
        const duration = occ.endDate.getTime() - occ.startDate.getTime()
        expect(duration).toBe(2.5 * 60 * 60 * 1000) // 2.5 hours
      }
    })
  })

  describe('getAllEventsInRange', () => {
    it('includes non-recurring events in range', () => {
      const events = [
        createEvent({
          id: '1',
          startDate: new Date(2025, 0, 15, 10, 0),
          endDate: new Date(2025, 0, 15, 11, 0),
          recurrence: 'none',
        }),
      ]
      const rangeStart = new Date(2025, 0, 1)
      const rangeEnd = new Date(2025, 0, 31)

      const result = getAllEventsInRange(events, rangeStart, rangeEnd)
      expect(result).toHaveLength(1)
      expect(result[0].isRecurrence).toBe(false)
    })

    it('expands recurring events in range', () => {
      const events = [
        createEvent({
          id: '1',
          startDate: new Date(2025, 0, 15, 10, 0),
          endDate: new Date(2025, 0, 15, 11, 0),
          recurrence: 'daily',
        }),
      ]
      const rangeStart = new Date(2025, 0, 15)
      const rangeEnd = new Date(2025, 0, 17)

      const result = getAllEventsInRange(events, rangeStart, rangeEnd)
      expect(result.length).toBeGreaterThanOrEqual(2)
    })

    it('sorts all events by start date', () => {
      const events = [
        createEvent({
          id: '1',
          title: 'Later Event',
          startDate: new Date(2025, 0, 20, 10, 0),
          endDate: new Date(2025, 0, 20, 11, 0),
          recurrence: 'none',
        }),
        createEvent({
          id: '2',
          title: 'Earlier Event',
          startDate: new Date(2025, 0, 10, 10, 0),
          endDate: new Date(2025, 0, 10, 11, 0),
          recurrence: 'none',
        }),
      ]
      const rangeStart = new Date(2025, 0, 1)
      const rangeEnd = new Date(2025, 0, 31)

      const result = getAllEventsInRange(events, rangeStart, rangeEnd)
      expect(result[0].title).toBe('Earlier Event')
      expect(result[1].title).toBe('Later Event')
    })

    it('marks recurring instances correctly', () => {
      const events = [
        createEvent({
          id: '1',
          startDate: new Date(2025, 0, 15, 10, 0),
          endDate: new Date(2025, 0, 15, 11, 0),
          recurrence: 'daily',
        }),
      ]
      const rangeStart = new Date(2025, 0, 15)
      const rangeEnd = new Date(2025, 0, 17)

      const result = getAllEventsInRange(events, rangeStart, rangeEnd)
      expect(result[0].isRecurrence).toBe(false)
      if (result.length > 1) {
        expect(result[1].isRecurrence).toBe(true)
      }
    })

    it('preserves original event ID for recurrences', () => {
      const events = [
        createEvent({
          id: 'event-123',
          startDate: new Date(2025, 0, 15, 10, 0),
          endDate: new Date(2025, 0, 15, 11, 0),
          recurrence: 'daily',
        }),
      ]
      const rangeStart = new Date(2025, 0, 15)
      const rangeEnd = new Date(2025, 0, 17)

      const result = getAllEventsInRange(events, rangeStart, rangeEnd)
      expect(result[0].originalEventId).toBe('event-123')
      if (result.length > 1) {
        expect(result[1].originalEventId).toBe('event-123')
      }
    })
  })
})
