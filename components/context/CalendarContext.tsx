"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { es } from "@/lib/encryptedStorage"

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
  addEvent: (newEvent: CalendarEvent) => void
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined)

// 默认日历分类
const defaultCalendars: CalendarCategory[] = [
  {
    id: "work",
    name: "工作",
    color: "bg-blue-500",
    keywords: [],
  },
  {
    id: "personal",
    name: "个人",
    color: "bg-green-500",
    keywords: [],
  },
]

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [calendars, setCalendarsState] = useState<CalendarCategory[]>([])
  const [events, setEventsState] = useState<CalendarEvent[]>([])

  useEffect(() => {
    const loadData = async () => {
      if (!es.isUnlocked) return

      const calendarsData = await es.getItem("calendar-categories")
      const eventsData = await es.getItem("calendar-events")

      if (calendarsData) {
        try {
          setCalendarsState(JSON.parse(calendarsData))
        } catch {}
      }

      if (eventsData) {
        try {
          setEventsState(JSON.parse(eventsData))
        } catch {}
      }
    }

    loadData()

    const handleStorageChange = () => {
      loadData()
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [])

  const setCalendars = async (calendars: CalendarCategory[]) => {
    await es.setItem("calendar-categories", JSON.stringify(calendars))
    setCalendarsState(calendars)
  }

  const setEvents = async (events: CalendarEvent[]) => {
    await es.setItem("calendar-events", JSON.stringify(events))
    setEventsState(events)
  }

  const addCategory = async (category: CalendarCategory) => {
    const updated = [...calendars, category]
    await setCalendars(updated)
  }

  const removeCategory = async (id: string) => {
    const updated = calendars.filter((cal) => cal.id !== id)
    await setCalendars(updated)
  }

  const updateCategory = async (id: string, category: Partial<CalendarCategory>) => {
    const updated = calendars.map((cal) => (cal.id === id ? { ...cal, ...category } : cal))
    await setCalendars(updated)
  }

  const addEvent = async (newEvent: CalendarEvent) => {
    const eventExists = events.some((event) => event.id === newEvent.id)
    const updated = eventExists
      ? events.map((event) => (event.id === newEvent.id ? newEvent : event))
      : [...events, newEvent]
    await setEvents(updated)
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
    throw new Error("useCalendar must be used within a CalendarProvider")
  }
  return context
}

export const useCalendarContext = useCalendar
