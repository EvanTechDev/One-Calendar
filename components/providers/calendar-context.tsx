'use client'

import type { Dispatch, SetStateAction } from 'react'
import type React from 'react'
import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import {
  readEncryptedLocalStorage,
  writeEncryptedLocalStorage,
} from '@/hooks/useLocalStorage'

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
    set((state: CalendarState) => ({ calendars: [...state.calendars, category] })),
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
  const calendars = useCalendarStore((state) => state.calendars)
  const events = useCalendarStore((state) => state.events)
  const setCalendars = useCalendarStore((state) => state.setCalendars)
  const setEvents = useCalendarStore((state) => state.setEvents)
  const hydratedRef = useRef(false)

  useEffect(() => {
    const hydrate = async () => {
      const storedCalendars = await readEncryptedLocalStorage<
        CalendarCategory[]
      >('calendar-categories', [])
      const storedEvents = await readEncryptedLocalStorage<CalendarEvent[]>(
        'calendar-events',
        [],
      )

      setCalendars(storedCalendars)
      setEvents(
        storedEvents.map((event) => ({
          ...event,
          startDate: new Date(event.startDate),
          endDate: new Date(event.endDate),
        })),
      )
      hydratedRef.current = true
    }

    void hydrate()
  }, [setCalendars, setEvents])

  useEffect(() => {
    if (!hydratedRef.current) return
    void writeEncryptedLocalStorage('calendar-categories', calendars)
  }, [calendars])

  useEffect(() => {
    if (!hydratedRef.current) return
    void writeEncryptedLocalStorage('calendar-events', events)
  }, [events])

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
