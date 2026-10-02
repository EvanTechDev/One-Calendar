import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { eventsOnDay, useEventsByDay } from '@/hooks/use-events-by-day'
import type { CalendarEvent } from '@/components/app/calendar'

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
  color: 'bg-[#E6F6FD]',
  calendarId: 'cal-1',
  location: '',
}

function createEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return { ...baseEvent, ...overrides }
}

function bucket(events: CalendarEvent[]) {
  const { result } = renderHook(() => useEventsByDay(events))
  return result.current
}

describe('useEventsByDay', () => {
  it('indexes an event under the day it falls on', () => {
    const event = createEvent()
    const byDay = bucket([event])

    expect(eventsOnDay(byDay, new Date(2025, 0, 15))).toEqual([event])
    expect(eventsOnDay(byDay, new Date(2025, 0, 16))).toEqual([])
  })

  /**
   * Bucketing by `startDate` alone is the bug this index is easy to reintroduce:
   * the second and third days of a multi-day event came up empty, so those
   * days' popovers rendered blank.
   */
  it('indexes every day a multi-day event occupies, not only the first', () => {
    const event = createEvent({
      isAllDay: true,
      startDate: new Date(2025, 0, 1),
      endDate: new Date(2025, 0, 3, 23, 59),
    })
    const byDay = bucket([event])

    expect(eventsOnDay(byDay, new Date(2025, 0, 1))).toEqual([event])
    expect(eventsOnDay(byDay, new Date(2025, 0, 2))).toEqual([event])
    expect(eventsOnDay(byDay, new Date(2025, 0, 3))).toEqual([event])
  })

  it('keeps an end at midnight exclusive of that day', () => {
    const event = createEvent({
      isAllDay: true,
      startDate: new Date(2025, 0, 1),
      endDate: new Date(2025, 0, 2),
    })
    const byDay = bucket([event])

    expect(eventsOnDay(byDay, new Date(2025, 0, 1))).toEqual([event])
    expect(eventsOnDay(byDay, new Date(2025, 0, 2))).toEqual([])
  })

  it('orders a day chronologically regardless of input order', () => {
    const late = createEvent({
      id: 'late',
      startDate: new Date(2025, 0, 15, 17, 0),
      endDate: new Date(2025, 0, 15, 18, 0),
    })
    const early = createEvent({
      id: 'early',
      startDate: new Date(2025, 0, 15, 9, 0),
      endDate: new Date(2025, 0, 15, 10, 0),
    })

    const byDay = bucket([late, early])

    expect(eventsOnDay(byDay, new Date(2025, 0, 15))).toEqual([early, late])
  })

  /**
   * The month view splits a day's bucket in two, so an event that landed in
   * the wrong bucket would vanish from the cell rather than merely mis-sort.
   */
  it('places each event in exactly one bucket per day it occupies', () => {
    const event = createEvent({
      isAllDay: true,
      startDate: new Date(2025, 0, 1),
      endDate: new Date(2025, 0, 3, 23, 59),
    })
    const byDay = bucket([event])

    const occurrences = [
      eventsOnDay(byDay, new Date(2025, 0, 1)),
      eventsOnDay(byDay, new Date(2025, 0, 2)),
      eventsOnDay(byDay, new Date(2025, 0, 3)),
    ].flat()

    expect(occurrences).toEqual([event, event, event])
  })

  it('returns a stable empty result for a day with no events', () => {
    const byDay = bucket([createEvent()])

    expect(eventsOnDay(byDay, new Date(2025, 5, 1))).toBe(
      eventsOnDay(byDay, new Date(2025, 5, 2)),
    )
  })

  /**
   * The identity of the index is what the views' downstream memos depend on, so
   * a rebuild on every render would reintroduce the cost this hook removed.
   */
  it('reuses the index while `events` is unchanged and rebuilds when it changes', () => {
    const first = [createEvent()]
    const { result, rerender } = renderHook(
      ({ events }: { events: CalendarEvent[] }) => useEventsByDay(events),
      { initialProps: { events: first } },
    )
    const initial = result.current

    rerender({ events: first })
    expect(result.current).toBe(initial)

    rerender({ events: [createEvent({ id: '3' })] })
    expect(result.current).not.toBe(initial)
    expect(
      eventsOnDay(result.current, new Date(2025, 0, 15)).map((e) => e.id),
    ).toEqual(['3'])
  })

  it('indexes nothing for an empty list', () => {
    expect(bucket([]).size).toBe(0)
  })
})
