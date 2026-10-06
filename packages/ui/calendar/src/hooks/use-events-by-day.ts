import { addDays, format, startOfDay } from 'date-fns'
import { useMemo } from 'react'
import type { CalendarEvent } from '#calendar/lib/calendar-types'
import {
  eventCalendarRange,
  shouldShowEventOnDay,
} from '#calendar/components/app/views/event-layout-engine'

/**
 * Buckets events by every day they occupy, keyed `yyyy-MM-dd`.
 *
 * The three grid views each want "the events visible on this day". Asked that
 * question per cell, each view walked the whole event list once per cell and
 * asked `shouldShowEventOnDay` about every event — 7 passes in the week view,
 * and 2 more per cell over 42 cells in the month view, so ~84 full passes per
 * render. Every one of those questions allocates 2-4 `Date`s inside the
 * predicate. The month view re-ran all of it on every drag-preview move, on
 * every 60-second `currentTime` tick, and after every save.
 *
 * The year view had already solved this for itself; this is that code, lifted
 * out so all three share one index. The answer per day is identical — the
 * predicate is the same function — so this is a lookup in place of a scan, not
 * a behaviour change.
 *
 * Two details are load-bearing and easy to undo by accident:
 *
 * - Every day the event occupies is bucketed, not just the one it starts on.
 *   Bucketing by `startDate` alone left the second and third days of a
 *   multi-day event blank: a 1st–3rd all-day event showed a dot on the 1st and
 *   nothing on the 2nd or 3rd, and those days' popovers came up empty.
 * - `shouldShowEventOnDay` stays the predicate, so an end at midnight remains
 *   exclusive of that day. The loop below only bounds which days are worth
 *   asking about.
 */
export function useEventsByDay(
  events: CalendarEvent[],
  timeZone?: string,
): ReadonlyMap<string, CalendarEvent[]> {
  return useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>()

    for (const event of events) {
      const { start, end } = eventCalendarRange(event, timeZone)
      const lastDay = startOfDay(end.getTime() > start.getTime() ? end : start)

      for (
        let day = startOfDay(start);
        day.getTime() <= lastDay.getTime();
        day = addDays(day, 1)
      ) {
        if (!shouldShowEventOnDay(event, day, timeZone)) continue
        const key = format(day, 'yyyy-MM-dd')
        const existing = grouped.get(key)
        if (existing) existing.push(event)
        else grouped.set(key, [event])
      }
    }

    // Chronological within a day, so a cell renders its bars in the order a
    // reader expects rather than in whatever order the store happened to
    // return. Same comparator the year view used.
    for (const dayEvents of grouped.values()) {
      dayEvents.sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      )
    }

    return grouped
  }, [events, timeZone])
}

/**
 * The events visible on one day, in the same order {@link useEventsByDay}
 * stored them.
 *
 * An unknown day yields an empty array rather than undefined so callers can
 * iterate unconditionally — and so the result keeps a stable identity when a
 * day genuinely has no events, which matters when it becomes a dependency of
 * a memo downstream.
 */
export function eventsOnDay(
  byDay: ReadonlyMap<string, CalendarEvent[]>,
  day: Date,
): readonly CalendarEvent[] {
  return byDay.get(format(day, 'yyyy-MM-dd')) ?? EMPTY
}

const EMPTY: readonly CalendarEvent[] = Object.freeze([])
