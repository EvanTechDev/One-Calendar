"use client"

import type React from "react"
import { createContext, useContext } from "react"
import { useLocalStorage } from "@/hooks/useLocalStorage"

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
  // 修改这里，使用空数组作为默认值，不自动创建分类
  const [calendars, setCalendars] = useLocalStorage<CalendarCategory[]>("calendar-categories", [])

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

  const addEvent = (newEvent: CalendarEvent) => {
    setEvents((prevEvents) => {
      // 检查事件是否已存在
      const eventExists = prevEvents.some((event) => event.id === newEvent.id)

      // 如果已存在，替换它；否则添加新事件
      if (eventExists) {
        return prevEvents.map((event) => (event.id === newEvent.id ? newEvent : event))
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
