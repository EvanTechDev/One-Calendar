'use client'

import { useMemo } from 'react'
import type { CalendarEvent } from '@/components/app/calendar'
import type { ViewConfig } from '@/components/app/calendar-types'
import { EventLayoutEngine as EventLayoutEngineClass } from '@/components/app/views/engine/EventLayoutEngine'
import type { LayoutEvent } from '@/components/app/views/engine/EventLayoutEngine'
import { isSameDay, isWithinInterval } from 'date-fns'

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
        return events.filter((event) => {
          const start = new Date(event.startDate)
          const end = new Date(event.endDate)

          if (!layoutEngine.isAllDayEvent(event)) {
            if (isSameDay(start, date)) return true

            if (layoutEngine.isMultiDayEvent(start, end)) {
              return isWithinInterval(date, { start, end })
            }

            return false
          }

          if (layoutEngine.isMultiDayEvent(start, end)) {
            return isSameDay(start, date)
          }

          return isSameDay(start, date)
        })
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
  }
}
