'use client'

import { useLocalStorage } from '@/hooks/useLocalStorage'
import {
  createContext,
  useContext,
  type Dispatch,
  type SetStateAction,
} from 'react'
import type React from 'react'

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

const CalendarContext = createContext<CalendarContextType | undefined>(
  undefined,
)

const defaultCalendars: CalendarCategory[] = [
  {
    id: 'work',
    name: '工作',
    color: 'bg-blue-500',
    keywords: [],
  },
  {
    id: 'personal',
    name: '个人',
    color: 'bg-green-500',
    keywords: [],
  },
]

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [calendars, setCalendars] = useLocalStorage<CalendarCategory[]>(
    'calendar-categories',
    [],
  )

  const [events, setEvents] = useLocalStorage<CalendarEvent[]>(
    'calendar-events',
    [],
  )

  const addCategory = (category: CalendarCategory) => {
    setCalendars([...calendars, category])
  }

  const removeCategory = (id: string) => {
    setCalendars(calendars.filter((cal) => cal.id !== id))
  }

  const updateCategory = (id: string, category: Partial<CalendarCategory>) => {
    setCalendars(
      calendars.map((cal) => (cal.id === id ? { ...cal, ...category } : cal)),
    )
  }

  const moveCategory = (id: string, direction: 'up' | 'down') => {
    setCalendars((prevCalendars) => {
      const currentIndex = prevCalendars.findIndex((cal) => cal.id === id)
      if (currentIndex === -1) return prevCalendars

      const targetIndex =
        direction === 'up' ? currentIndex - 1 : currentIndex + 1

      if (targetIndex < 0 || targetIndex >= prevCalendars.length) {
        return prevCalendars
      }

      const nextCalendars = [...prevCalendars]
      const [movedCalendar] = nextCalendars.splice(currentIndex, 1)
      nextCalendars.splice(targetIndex, 0, movedCalendar)
      return nextCalendars
    })
  }

  const addEvent = (newEvent: CalendarEvent) => {
    setEvents((prevEvents) => {
      const eventExists = prevEvents.some((event) => event.id === newEvent.id)

      if (eventExists) {
        return prevEvents.map((event) =>
          event.id === newEvent.id ? newEvent : event,
        )
      } else {
        return [...prevEvents, newEvent]
      }
    })
  }

  return (
    <CalendarContext.Provider
      value={{
        calendars,
        setCalendars,
        events,
        setEvents,
        addCategory,
        removeCategory,
        updateCategory,
        moveCategory,
        addEvent,
      }}
    >
      {children}
    </CalendarContext.Provider>
  )
}

export function useCalendar() {
  const context = useContext(CalendarContext)
  if (context === undefined) {
    throw new Error('useCalendar must be used within a CalendarProvider')
  }
  return context
}

export const useCalendarContext = useCalendar
