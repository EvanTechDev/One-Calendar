'use client'

import type { Dispatch, SetStateAction } from 'react'
import type React from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

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

const useCalendarStore = create<CalendarState>()(
  persist(
    (set) => ({
      calendars: [],
      events: [],
      setCalendars: (value) =>
        set((state) => ({
          calendars:
            typeof value === 'function' ? value(state.calendars) : value,
        })),
      setEvents: (value) =>
        set((state) => ({
          events: typeof value === 'function' ? value(state.events) : value,
        })),
      addCategory: (category) =>
        set((state) => ({ calendars: [...state.calendars, category] })),
      removeCategory: (id) =>
        set((state) => ({
          calendars: state.calendars.filter((cal) => cal.id !== id),
        })),
      updateCategory: (id, category) =>
        set((state) => ({
          calendars: state.calendars.map((cal) =>
            cal.id === id ? { ...cal, ...category } : cal,
          ),
        })),
      moveCategory: (id, direction) =>
        set((state) => {
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
      addEvent: (newEvent) =>
        set((state) => {
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
    }),
    {
      name: 'calendar-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        calendars: state.calendars,
        events: state.events,
      }),
    },
  ),
)

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  return children
}

export function useCalendar(): CalendarContextType {
  return useCalendarStore()
}

export const useCalendarContext = useCalendar
