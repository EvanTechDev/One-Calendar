'use client'

import { useMemo } from 'react'
import type { CalendarEvent } from '@/components/app/calendar'
import type { CalendarCategory } from '@/components/providers/calendar-context'

export function useEventFiltering(
  events: CalendarEvent[],
  calendars: CalendarCategory[],
  selectedCategoryFilters: string[],
  searchTerm: string,
) {
  const eventsByCategory = useMemo(() => {
    if (selectedCategoryFilters.length === 0) return events

    return events.filter((event) => {
      if (!event.calendarId) {
        return selectedCategoryFilters.includes('__uncategorized__')
      }

      const hasCategory = calendars.some((cal) => cal.id === event.calendarId)
      if (!hasCategory)
        return selectedCategoryFilters.includes('__uncategorized__')
      return selectedCategoryFilters.includes(event.calendarId)
    })
  }, [events, selectedCategoryFilters, calendars])

  const filteredEvents = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    if (!keyword) return eventsByCategory

    return eventsByCategory
      .filter((event) => {
        const title = event.title?.toLowerCase() || ''
        const location = event.location?.toLowerCase() || ''
        const description = event.description?.toLowerCase() || ''
        return (
          title.includes(keyword) ||
          location.includes(keyword) ||
          description.includes(keyword)
        )
      })
      .sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      )
  }, [eventsByCategory, searchTerm])

  const searchResultEvents = useMemo(() => {
    if (!searchTerm.trim()) return []
    return filteredEvents.slice(0, 8)
  }, [filteredEvents, searchTerm])

  return {
    eventsByCategory,
    filteredEvents,
    searchResultEvents,
  }
}
