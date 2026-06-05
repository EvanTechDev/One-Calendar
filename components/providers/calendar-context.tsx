'use client'

import type { Dispatch, SetStateAction } from 'react'
import type React from 'react'
import { useCallback, useEffect, useRef } from 'react'
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
  isLoadingCalendarData: boolean
  loadedRanges: Array<{ start: Date; end: Date }>
  loadCalendarRange: (
    start: Date,
    end: Date,
    replace?: boolean,
  ) => Promise<void>
  addCategory: (category: CalendarCategory) => void
  removeCategory: (id: string, deleteEvents?: boolean) => void
  updateCategory: (id: string, category: Partial<CalendarCategory>) => void
  moveCategory: (id: string, direction: 'up' | 'down') => void
  addEvent: (newEvent: CalendarEvent) => void
}

interface CalendarState {
  calendars: CalendarCategory[]
  events: CalendarEvent[]
  isLoadingCalendarData: boolean
  loadedRanges: Array<{ start: Date; end: Date }>
  setCalendars: (value: SetStateAction<CalendarCategory[]>) => void
  setEvents: (value: SetStateAction<CalendarEvent[]>) => void
  setLoading: (loading: boolean) => void
  addLoadedRange: (range: { start: Date; end: Date }) => void
  mergeEvents: (
    events: CalendarEvent[],
    range?: { start: Date; end: Date },
    replace?: boolean,
  ) => void
  addCategory: (category: CalendarCategory) => void
  removeCategory: (id: string, deleteEvents?: boolean) => void
  updateCategory: (id: string, category: Partial<CalendarCategory>) => void
  moveCategory: (id: string, direction: 'up' | 'down') => void
  addEvent: (newEvent: CalendarEvent) => void
}

function toEvent(raw: any): CalendarEvent {
  return {
    ...raw,
    id: String(raw?.id || crypto.randomUUID()),
    title: String(raw?.title || ''),
    startDate: raw?.startDate ? new Date(raw.startDate) : new Date(),
    endDate: raw?.endDate ? new Date(raw.endDate) : new Date(),
    isAllDay: Boolean(raw?.isAllDay),
    recurrence: ['none', 'daily', 'weekly', 'monthly', 'yearly'].includes(
      raw?.recurrence,
    )
      ? raw.recurrence
      : 'none',
    participants: Array.isArray(raw?.participants) ? raw.participants : [],
    notification: Number.isFinite(Number(raw?.notification))
      ? Number(raw.notification)
      : 0,
    color: String(raw?.color || 'bg-blue-500'),
    calendarId: String(raw?.calendarId || ''),
  }
}

function eventInRange(event: CalendarEvent, range: { start: Date; end: Date }) {
  return event.startDate <= range.end && event.endDate >= range.start
}

const useCalendarStore = create<CalendarState>()((set) => ({
  calendars: [],
  events: [],
  isLoadingCalendarData: true,
  loadedRanges: [],
  setCalendars: (value) =>
    set((state) => ({
      calendars: typeof value === 'function' ? value(state.calendars) : value,
    })),
  setEvents: (value) =>
    set((state) => ({
      events: typeof value === 'function' ? value(state.events) : value,
    })),
  setLoading: (loading) => set({ isLoadingCalendarData: loading }),
  addLoadedRange: (range) =>
    set((state) => ({ loadedRanges: [...state.loadedRanges, range] })),
  mergeEvents: (incoming, range, replace) =>
    set((state) => {
      const incomingMap = new Map(incoming.map((event) => [event.id, event]))
      const kept = replace
        ? []
        : state.events.filter(
            (event) =>
              !incomingMap.has(event.id) &&
              (!range || !eventInRange(event, range)),
          )
      return {
        events: [...kept, ...incoming].sort(
          (a, b) => a.startDate.getTime() - b.startDate.getTime(),
        ),
      }
    }),
  addCategory: (category) =>
    set((state) => ({ calendars: [...state.calendars, category] })),
  removeCategory: (id, deleteEvents = false) =>
    set((state) => ({
      calendars: state.calendars.filter((cal) => cal.id !== id),
      events: deleteEvents
        ? state.events.filter((event) => event.calendarId !== id)
        : state.events,
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
      const targetIndex =
        direction === 'up' ? currentIndex - 1 : currentIndex + 1
      if (
        currentIndex === -1 ||
        targetIndex < 0 ||
        targetIndex >= state.calendars.length
      )
        return {}
      const nextCalendars = [...state.calendars]
      const [movedCalendar] = nextCalendars.splice(currentIndex, 1)
      nextCalendars.splice(targetIndex, 0, movedCalendar)
      return { calendars: nextCalendars }
    }),
  addEvent: (newEvent) =>
    set((state) => ({
      events: state.events.some((event) => event.id === newEvent.id)
        ? state.events.map((event) =>
            event.id === newEvent.id ? newEvent : event,
          )
        : [...state.events, newEvent],
    })),
}))

async function isSignedIn() {
  try {
    const response = await fetch('/api/auth/get-session', { cache: 'no-store' })
    const data = response.ok ? await response.json() : null
    return Boolean(data && typeof data === 'object' && 'session' in data)
  } catch {
    return false
  }
}

async function postCalendarData(body: unknown) {
  const response = await fetch('/api/blob', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return response.ok
}

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const calendars = useCalendarStore((state) => state.calendars)
  const events = useCalendarStore((state) => state.events)
  const setCalendars = useCalendarStore((state) => state.setCalendars)
  const setEvents = useCalendarStore((state) => state.setEvents)
  const mergeEvents = useCalendarStore((state) => state.mergeEvents)
  const setLoading = useCalendarStore((state) => state.setLoading)
  const addLoadedRange = useCalendarStore((state) => state.addLoadedRange)
  const signedInRef = useRef(false)
  const hydratedRef = useRef(false)
  const skipPersistRef = useRef(true)

  const loadCalendarRange = useCallback(
    async (start: Date, end: Date, replace = false) => {
      if (!signedInRef.current) return
      setLoading(true)
      try {
        const params = new URLSearchParams({
          start: start.toISOString(),
          end: end.toISOString(),
        })
        const response = await fetch(`/api/blob?${params}`, {
          cache: 'no-store',
        })
        if (response.status === 404) return
        if (!response.ok) throw new Error('Failed to load calendar data')
        const data = await response.json()
        skipPersistRef.current = true
        if (Array.isArray(data.calendars)) setCalendars(data.calendars)
        mergeEvents(
          Array.isArray(data.events) ? data.events.map(toEvent) : [],
          { start, end },
          replace,
        )
        addLoadedRange({ start, end })
      } finally {
        setLoading(false)
        window.setTimeout(() => {
          skipPersistRef.current = false
        }, 0)
      }
    },
    [addLoadedRange, mergeEvents, setCalendars, setLoading],
  )

  useEffect(() => {
    const hydrate = async () => {
      signedInRef.current = await isSignedIn()
      if (signedInRef.current) {
        const now = new Date()
        await loadCalendarRange(
          new Date(now.getFullYear(), now.getMonth() - 1, 1),
          new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999),
          true,
        )
      } else {
        const storedCalendars = await readEncryptedLocalStorage<
          CalendarCategory[]
        >('calendar-categories', [])
        const storedEvents = await readEncryptedLocalStorage<CalendarEvent[]>(
          'calendar-events',
          [],
        )
        setCalendars(storedCalendars)
        setEvents(storedEvents.map(toEvent))
        setLoading(false)
        skipPersistRef.current = false
      }
      hydratedRef.current = true
    }
    void hydrate()
  }, [loadCalendarRange, setCalendars, setEvents, setLoading])

  useEffect(() => {
    if (!hydratedRef.current || skipPersistRef.current) return undefined
    if (signedInRef.current) {
      const timer = window.setTimeout(() => {
        void postCalendarData({ calendars })
      }, 500)
      return () => {
        window.clearTimeout(timer)
      }
    }
    void writeEncryptedLocalStorage('calendar-categories', calendars)
    return undefined
  }, [calendars])

  useEffect(() => {
    if (!hydratedRef.current || skipPersistRef.current) return undefined
    if (signedInRef.current) {
      const timer = window.setTimeout(() => {
        void postCalendarData({ events })
      }, 500)
      return () => {
        window.clearTimeout(timer)
      }
    }
    void writeEncryptedLocalStorage('calendar-events', events)
    return undefined
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
    isLoadingCalendarData: store.isLoadingCalendarData,
    loadedRanges: store.loadedRanges,
    loadCalendarRange: async (start, end, replace) => {
      useCalendarStore.getState().setLoading(true)
      try {
        const params = new URLSearchParams({
          start: start.toISOString(),
          end: end.toISOString(),
        })
        const response = await fetch(`/api/blob?${params}`, {
          cache: 'no-store',
        })
        if (!response.ok) return
        const data = await response.json()
        useCalendarStore
          .getState()
          .setCalendars(Array.isArray(data.calendars) ? data.calendars : [])
        useCalendarStore
          .getState()
          .mergeEvents(
            Array.isArray(data.events) ? data.events.map(toEvent) : [],
            { start, end },
            replace,
          )
        useCalendarStore.getState().addLoadedRange({ start, end })
      } finally {
        useCalendarStore.getState().setLoading(false)
      }
    },
    addCategory: store.addCategory,
    removeCategory: store.removeCategory,
    updateCategory: store.updateCategory,
    moveCategory: store.moveCategory,
    addEvent: store.addEvent,
  }
}

export const useCalendarContext = useCalendar
