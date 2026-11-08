'use client'

import type { Dispatch, SetStateAction } from 'react'
import type React from 'react'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { create, useStore, type StoreApi } from 'zustand'
import { useData } from '#calendar/components/providers/data-provider'
import type { EventData } from '#calendar/lib/api-client'
import type { CategoryData } from '#calendar/lib/api-client'
import type { CalendarEvent } from '#calendar/lib/calendar-types'

// Re-exported so the ~35 modules that already import it from the context keep
// working; the declaration itself has one home now.
export type { CalendarEvent }

export interface CalendarCategory {
  id: string
  name: string
  color: string
  keywords?: string[]
}

export function eventDataToCalendarEvent(e: EventData): CalendarEvent {
  return {
    id: e.id,
    title: e.title,
    startDate: new Date(e.startDate),
    endDate: new Date(e.endDate),
    isAllDay: e.isAllDay,
    rrule: e.rrule ?? null,
    exdate: e.exdate ?? null,
    seriesId: e.seriesId ?? null,
    recurrenceId: e.recurrenceId ?? null,
    isOverride: e.isOverride === true,
    isFirstInstance: e.isFirstInstance === true,
    seriesStartDate: e.seriesStartDate ? new Date(e.seriesStartDate) : null,
    location: e.location ?? undefined,
    participants: e.participants?.map((p) => p.email ?? p.name) ?? [],
    notification: e.notificationMinutes ?? null,
    emailReminder: e.emailReminder === true,
    description: e.description ?? undefined,
    color: e.color ?? '#3B82F6',
    calendarId: e.categoryId ?? '',
    viewOnly: e.viewOnly,
    organizer: e.organizer,
    invites: e.invites,
    meeting: e.meeting ?? null,
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

function createCalendarStore(initial?: {
  events?: CalendarEvent[]
  calendars?: CalendarCategory[]
}) {
  return create<CalendarState>()((set) => ({
    calendars: initial?.calendars ?? [],
    events: initial?.events ?? [],
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
        const eventExists = state.events.some(
          (event) => event.id === newEvent.id,
        )

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
}

const globalCalendarStore = createCalendarStore()
const CalendarStoreContext = createContext<StoreApi<CalendarState>>(
  globalCalendarStore,
)

export interface CalendarInitialData {
  events: CalendarEvent[]
  calendars: CalendarCategory[]
}

export function CalendarProvider({
  children,
  initialData,
}: {
  children: React.ReactNode
  initialData?: CalendarInitialData
}) {
  const {
    events: serverEvents,
    categories: serverCategories,
    eventsLoaded,
    categoriesLoaded,
  } = useData()
  // A demo mounts its own store so it can start fully populated on the server
  // and never shares state with the signed-in calendar in the same tab.
  const [scopedStore] = useState(() =>
    initialData ? createCalendarStore(initialData) : null,
  )
  const store = scopedStore ?? globalCalendarStore
  const setCalendars = useStore(store, (state) => state.setCalendars)
  const setEvents = useStore(store, (state) => state.setEvents)
  const hydratedRef = useRef(false)
  const lastEventsRef = useRef<EventData[] | null>(null)

  useEffect(() => {
    if (scopedStore) return
    if (!eventsLoaded || !categoriesLoaded) return
    if (!hydratedRef.current) {
      hydratedRef.current = true
      lastEventsRef.current = serverEvents
      setCalendars(serverCategories.map(categoryDataToCalendarCategory))
      setEvents(serverEvents.map(eventDataToCalendarEvent))
      return
    }
    if (lastEventsRef.current !== serverEvents) {
      lastEventsRef.current = serverEvents
      setEvents(serverEvents.map(eventDataToCalendarEvent))
    }
  }, [
    scopedStore,
    serverEvents,
    serverCategories,
    eventsLoaded,
    categoriesLoaded,
    setCalendars,
    setEvents,
  ])

  return (
    <CalendarStoreContext.Provider value={store}>
      {children}
    </CalendarStoreContext.Provider>
  )
}

export function useCalendar(): CalendarContextType {
  const store = useContext(CalendarStoreContext)
  const state = useStore(store)
  return {
    calendars: state.calendars,
    setCalendars: state.setCalendars,
    events: state.events,
    setEvents: state.setEvents,
    addCategory: state.addCategory,
    removeCategory: state.removeCategory,
    updateCategory: state.updateCategory,
    moveCategory: state.moveCategory,
    addEvent: state.addEvent,
  }
}

export const useCalendarContext = useCalendar
