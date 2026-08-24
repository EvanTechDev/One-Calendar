'use client'

import { useMemo } from 'react'
import type { CalendarEvent } from '@/components/app/calendar'
import type { ViewConfig } from '@/lib/calendar-types'
import { EventLayoutEngine as EventLayoutEngineClass } from '@/components/app/views/event-layout-engine'
import type { LayoutEvent } from '@/components/app/views/event-layout-engine'

interface UseEventFilterOptions {
  events: CalendarEvent[]
  config: ViewConfig
  date: Date
}

interface UseEventFilterReturn {
  allDayEventsForDate: (date: Date) => CalendarEvent[]
  regularEventsForDate: (date: Date) => CalendarEvent[]
  layoutEventsForDate: (date: Date) => LayoutEvent[]
  getDayEvents: (date: Date) => CalendarEvent[]
  layoutEngine: InstanceType<typeof EventLayoutEngineClass>
}

export function useEventFilter({
  events,
  config,
}: UseEventFilterOptions): UseEventFilterReturn {
  const layoutEngine = useMemo(
    () => EventLayoutEngineClass.create(config),
    [config],
  )

  const getDayEvents = useMemo(
    () =>
      (date: Date): CalendarEvent[] => {
        // Single source of truth: the engine's day filter, which shows
        // banner events (all-day and full-day-spanning timed events) on
        // every day they cover.
        return events.filter((event) =>
          layoutEngine.shouldShowEventOnDay(event, date),
        )
      },
    [events, layoutEngine],
  )

  const allDayEventsForDate = useMemo(
    () =>
      (date: Date): CalendarEvent[] => {
        const dayEvents = getDayEvents(date)
        const { allDayEvents } = layoutEngine.separateEvents(dayEvents, date)
        return allDayEvents
      },
    [getDayEvents, layoutEngine],
  )

  const regularEventsForDate = useMemo(
    () =>
      (date: Date): CalendarEvent[] => {
        const dayEvents = getDayEvents(date)
        const { regularEvents } = layoutEngine.separateEvents(dayEvents, date)
        return regularEvents
      },
    [getDayEvents, layoutEngine],
  )

  const layoutEventsForDate = useMemo(
    () =>
      (date: Date): LayoutEvent[] => {
        const regularEvents = regularEventsForDate(date)
        return layoutEngine.layoutEventsForDay(regularEvents, date)
      },
    [regularEventsForDate, layoutEngine],
  )

  return {
    allDayEventsForDate,
    regularEventsForDate,
    layoutEventsForDate,
    getDayEvents,
    layoutEngine,
  }
}
