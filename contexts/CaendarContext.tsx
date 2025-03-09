"use client"

import type React from "react"
import { createContext, useContext } from "react"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import { defaultTimeCategories } from "@/utils/time-analytics"

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
  recurrence: "none" | "daily" | "weekly" | "monthly" | "yearly"
  location?: string
  participants: string[]
  notification: number
  description?: string
  color: string
  calendarId: string
}

interface CalendarContextType {
  calendars: CalendarCategory[]
  setCalendars: (calendars: CalendarCategory[]) => void
  events: CalendarEvent[]
  setEvents: (events: CalendarEvent[]) => void
  addCategory: (category: CalendarCategory) => void
  removeCategory: (id: string) => void
  updateCategory: (id: string, category: Partial<CalendarCategory>) => void
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined)

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [calendars, setCalendars] = useLocalStorage<CalendarCategory[]>(
    "calendar-categories",
    defaultTimeCategories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      color: cat.color,
      keywords: cat.keywords,
    })),
  )

  const [events, setEvents] = useLocalStorage<CalendarEvent[]>("calendar-events", [])

  const addCategory = (category: CalendarCategory) => {
    setCalendars([...calendars, category])
  }

  const removeCategory = (id: string) => {
    setCalendars(calendars.filter((cal) => cal.id !== id))
  }

  const updateCategory = (id: string, category: Partial<CalendarCategory>) => {
    setCalendars(calendars.map((cal) => (cal.id === id ? { ...cal, ...category } : cal)))
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
      }}
    >
      {children}
    </CalendarContext.Provider>
  )
}

export function useCalendar() {
  const context = useContext(CalendarContext)
  if (context === undefined) {
    throw new Error("useCalendar must be used within a CalendarProvider")
  }
  return context
}

