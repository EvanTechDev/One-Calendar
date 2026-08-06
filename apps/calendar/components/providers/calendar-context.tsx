'use client'

import type { Dispatch, SetStateAction } from 'react'
import type React from 'react'
import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { useData } from '@/components/providers/data-provider'
import type { EventData } from '@/lib/api-client'
import type { CategoryData } from '@/lib/api-client'

export interface CalendarCategory {
  id: string
  name: string
  color: string
  keywords?: string[]
}

export interface CalendarEvent {
  id: string
  title: string
  startDate: Date
  endDate: Date
  isAllDay: boolean
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  location?: string
  participants: string[]
  notification: number
  description?: string
  color: string
  calendarId: string
}

function eventDataToCalendarEvent(e: EventData): CalendarEvent {
  return {
    id: e.id,
    title: e.title,
    startDate: new Date(e.startDate),
    endDate: new Date(e.endDate),
    isAllDay: e.isAllDay,
    recurrence: 'none',
    location: e.location ?? undefined,
    participants: e.participants?.map((p: { name: string }) => p.name) ?? [],
    notification: e.notificationMinutes ?? 0,
    description: e.description ?? undefined,
    color: e.color ?? '#3B82F6',
    calendarId: e.categoryId ?? '',
  }
}

function categoryDataToCalendarCategory(c: CategoryData): CalendarCategory {
  return {
    id: c.id,
    name: c.name,
    color: c.color,
  }
}

interface CalendarContextType {
  calendars: CalendarCategory[]
  setCalendars: Dispatch<SetStateAction<CalendarCategory[]>>
  events: CalendarEvent[]
  setEvents: Dispatch<SetStateAction<CalendarEvent[]>>
  addCategory: (category: CalendarCategory) => void
  removeCategory: (id: string) => void
  updateCategory: (id: string, category: Partial<CalendarCategory>) => void
  moveCategory: (id: string, direction: 'up' | 'down') => void
  addEvent: (newEvent: CalendarEvent) => void
}

interface CalendarState {
  calendars: CalendarCategory[]
  events: CalendarEvent[]
  setCalendars: (value: SetStateAction<CalendarCategory[]>) => void
  setEvents: (value: SetStateAction<CalendarEvent[]>) => void
  addCategory: (category: CalendarCategory) => void
  removeCategory: (id: string) => void
  updateCategory: (id: string, category: Partial<CalendarCategory>) => void
  moveCategory: (id: string, direction: 'up' | 'down') => void
  addEvent: (newEvent: CalendarEvent) => void
}

const useCalendarStore = create<CalendarState>()((set) => ({
  calendars: [],
  events: [],
  setCalendars: (value: SetStateAction<CalendarCategory[]>) =>
    set((state: CalendarState) => ({
      calendars: typeof value === 'function' ? value(state.calendars) : value,
    })),
  setEvents: (value: SetStateAction<CalendarEvent[]>) =>
    set((state: CalendarState) => ({
      events: typeof value === 'function' ? value(state.events) : value,
    })),
  addCategory: (category: CalendarCategory) =>
    set((state: CalendarState) => ({
      calendars: [...state.calendars, category],
    })),
  removeCategory: (id: string) =>
    set((state: CalendarState) => ({
      calendars: state.calendars.filter((cal) => cal.id !== id),
    })),
  updateCategory: (id: string, category: Partial<CalendarCategory>) =>
    set((state: CalendarState) => ({
      calendars: state.calendars.map((cal) =>
        cal.id === id ? { ...cal, ...category } : cal,
      ),
    })),
  moveCategory: (id: string, direction: 'up' | 'down') =>
    set((state: CalendarState) => {
      const currentIndex = state.calendars.findIndex((cal) => cal.id === id)
      if (currentIndex === -1) return { calendars: state.calendars }

      const targetIndex =
        direction === 'up' ? currentIndex - 1 : currentIndex + 1

      if (targetIndex < 0 || targetIndex >= state.calendars.length) {
        return { calendars: state.calendars }
      }

      const nextCalendars = [...state.calendars]
      const [movedCalendar] = nextCalendars.splice(currentIndex, 1)
      nextCalendars.splice(targetIndex, 0, movedCalendar)

      return { calendars: nextCalendars }
    }),
  addEvent: (newEvent: CalendarEvent) =>
    set((state: CalendarState) => {
      const eventExists = state.events.some((event) => event.id === newEvent.id)

      if (eventExists) {
        return {
          events: state.events.map((event) =>
            event.id === newEvent.id ? newEvent : event,
          ),
        }
      }

      return { events: [...state.events, newEvent] }
    }),
}))

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const {
    events: serverEvents,
    categories: serverCategories,
    eventsLoaded,
    categoriesLoaded,
  } = useData()
  const setCalendars = useCalendarStore((state) => state.setCalendars)
  const setEvents = useCalendarStore((state) => state.setEvents)
  const syncedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!eventsLoaded || !categoriesLoaded) return
    const key = JSON.stringify(serverCategories.map((c) => c.id))
    if (key === syncedRef.current) return
    syncedRef.current = key
    setCalendars(serverCategories.map(categoryDataToCalendarCategory))
    setEvents(serverEvents.map(eventDataToCalendarEvent))
  }, [
    serverEvents,
    serverCategories,
    eventsLoaded,
    categoriesLoaded,
    setCalendars,
    setEvents,
  ])

  return children
}

export function useCalendar(): CalendarContextType {
  const store = useCalendarStore()
  return {
    calendars: store.calendars,
    setCalendars: store.setCalendars,
    events: store.events,
    setEvents: store.setEvents,
    addCategory: store.addCategory,
    removeCategory: store.removeCategory,
    updateCategory: store.updateCategory,
    moveCategory: store.moveCategory,
    addEvent: store.addEvent,
  }
}

export const useCalendarContext = useCalendar
