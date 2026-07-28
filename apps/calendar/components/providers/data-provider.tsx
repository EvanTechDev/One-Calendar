'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import {
  api,
  type EventData,
  type CategoryData,
  type CountdownData,
  type BookmarkData,
  type SettingsData,
} from '@/lib/api-client'
import { toast } from 'sonner'

type LoadingState = 'idle' | 'loading' | 'loaded' | 'error'

interface DataContextValue {
  events: EventData[]
  categories: CategoryData[]
  countdowns: CountdownData[]
  bookmarks: BookmarkData[]
  settings: SettingsData
  loading: LoadingState
  error: string | null

  refresh: () => Promise<void>
  refreshEvents: () => Promise<void>
  refreshCategories: () => Promise<void>
  refreshCountdowns: () => Promise<void>
  refreshBookmarks: () => Promise<void>
  refreshSettings: () => Promise<void>

  upsertEvent: (
    data: Parameters<typeof api.events.create>[0],
  ) => Promise<EventData>
  deleteEvent: (id: string) => Promise<void>

  createCategory: (
    data: Parameters<typeof api.categories.create>[0],
  ) => Promise<CategoryData>
  deleteCategory: (id: string) => Promise<void>

  createCountdown: (
    data: Parameters<typeof api.countdowns.create>[0],
  ) => Promise<CountdownData>
  deleteCountdown: (id: string) => Promise<void>

  createBookmark: (
    data: Parameters<typeof api.bookmarks.create>[0],
  ) => Promise<void>
  deleteBookmark: (id: string) => Promise<void>
  deleteBookmarkByEvent: (eventId: string) => Promise<void>

  updateSettings: (data: SettingsData) => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<EventData[]>([])
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [countdowns, setCountdowns] = useState<CountdownData[]>([])
  const [bookmarks, setBookmarks] = useState<BookmarkData[]>([])
  const [settings, setSettings] = useState<SettingsData>({})
  const [loading, setLoading] = useState<LoadingState>('idle')
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetchAll = useCallback(async () => {
    setLoading('loading')
    setError(null)
    try {
      const [
        eventsRes,
        categoriesRes,
        countdownsRes,
        bookmarksRes,
        settingsRes,
      ] = await Promise.all([
        api.events.list().catch(() => ({ events: [] })),
        api.categories.list().catch(() => ({ categories: [] })),
        api.countdowns.list().catch(() => ({ countdowns: [] })),
        api.bookmarks.list().catch(() => ({ bookmarks: [] })),
        api.settings.get().catch(() => ({ settings: {} })),
      ])
      if (!mountedRef.current) return
      setEvents(eventsRes.events)
      setCategories(categoriesRes.categories)
      setCountdowns(countdownsRes.countdowns)
      setBookmarks(bookmarksRes.bookmarks)
      setSettings(settingsRes.settings)
      setLoading('loaded')
    } catch (e) {
      if (!mountedRef.current) return
      setError(e instanceof Error ? e.message : 'Failed to load data')
      setLoading('error')
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void fetchAll()
    return () => {
      mountedRef.current = false
    }
  }, [fetchAll])

  const refreshEvents = useCallback(async () => {
    const res = await api.events.list()
    setEvents(res.events)
  }, [])

  const refreshCategories = useCallback(async () => {
    const res = await api.categories.list()
    setCategories(res.categories)
  }, [])

  const refreshCountdowns = useCallback(async () => {
    const res = await api.countdowns.list()
    setCountdowns(res.countdowns)
  }, [])

  const refreshBookmarks = useCallback(async () => {
    const res = await api.bookmarks.list()
    setBookmarks(res.bookmarks)
  }, [])

  const refreshSettings = useCallback(async () => {
    const res = await api.settings.get()
    setSettings(res.settings)
  }, [])

  useEffect(() => {
    if (loading !== 'loaded') return
    if (Object.keys(settings).length > 0) return

    const migrateFromLocalStorage = async () => {
      const migrated: string[] = []

      const settingKeyMap: Record<string, string> = {
        'preferred-language': 'language',
        'first-day-of-week': 'firstDayOfWeek',
        timezone: 'timezone',
        'default-view': 'defaultView',
      }

      const migrations: Array<{
        key: string
        value: string | null
        transform?: (v: string) => unknown
      }> = [
        {
          key: 'preferred-language',
          value: localStorage.getItem('preferred-language'),
        },
        {
          key: 'first-day-of-week',
          value: localStorage.getItem('first-day-of-week'),
          transform: (v) => Number(v),
        },
        { key: 'timezone', value: localStorage.getItem('timezone') },
        { key: 'default-view', value: localStorage.getItem('default-view') },
      ]

      for (const { key, value, transform } of migrations) {
        if (!value) continue
        const settingKey = settingKeyMap[key]
        const settingValue = transform ? transform(value) : value
        try {
          await api.settings.update({
            [settingKey]: settingValue,
          } as SettingsData)
          migrated.push(settingKey)
        } catch (e) {
          toast.error('Migration failed', {
            description: `${settingKey}: ${e instanceof Error ? e.message : 'Unknown'}`,
          })
        }
      }

      if (migrated.length > 0) {
        await refreshSettings()
      }
    }

    void migrateFromLocalStorage()
  }, [loading, settings, refreshSettings])

  const upsertEvent = useCallback(
    async (data: Parameters<typeof api.events.create>[0]) => {
      try {
        const res = await api.events.create(data)
        setEvents((prev) => {
          const idx = prev.findIndex((e) => e.id === res.event.id)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = res.event
            return next
          }
          return [...prev, res.event]
        })
        return res.event
      } catch (e) {
        toast.error('Failed to save event', {
          description: e instanceof Error ? e.message : 'Unknown',
        })
        throw e
      }
    },
    [],
  )

  const deleteEvent = useCallback(async (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id))
    try {
      await api.events.delete(id)
    } catch (e) {
      toast.error('Failed to delete event', {
        description: e instanceof Error ? e.message : 'Unknown',
      })
      throw e
    }
  }, [])

  const createCategory = useCallback(
    async (data: Parameters<typeof api.categories.create>[0]) => {
      try {
        const res = await api.categories.create(data)
        setCategories((prev) => {
          const idx = prev.findIndex((c) => c.id === res.category.id)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = res.category
            return next
          }
          return [...prev, res.category]
        })
        return res.category
      } catch (e) {
        toast.error('Failed to create category', {
          description: e instanceof Error ? e.message : 'Unknown',
        })
        throw e
      }
    },
    [],
  )

  const deleteCategory = useCallback(async (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id))
    try {
      await api.categories.delete(id)
    } catch (e) {
      toast.error('Failed to delete category', {
        description: e instanceof Error ? e.message : 'Unknown',
      })
      throw e
    }
  }, [])

  const createCountdown = useCallback(
    async (data: Parameters<typeof api.countdowns.create>[0]) => {
      try {
        const res = await api.countdowns.create(data)
        setCountdowns((prev) => {
          const idx = prev.findIndex((c) => c.id === res.countdown.id)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = res.countdown
            return next
          }
          return [...prev, res.countdown]
        })
        return res.countdown
      } catch (e) {
        toast.error('Failed to create countdown', {
          description: e instanceof Error ? e.message : 'Unknown',
        })
        throw e
      }
    },
    [],
  )

  const deleteCountdown = useCallback(async (id: string) => {
    setCountdowns((prev) => prev.filter((c) => c.id !== id))
    try {
      await api.countdowns.delete(id)
    } catch (e) {
      toast.error('Failed to delete countdown', {
        description: e instanceof Error ? e.message : 'Unknown',
      })
      throw e
    }
  }, [])

  const eventsRef = useRef(events)
  eventsRef.current = events

  const createBookmark = useCallback(
    async (data: Parameters<typeof api.bookmarks.create>[0]) => {
      try {
        const res = await api.bookmarks.create(data)
        if (res.bookmark) {
          const evt = eventsRef.current.find((e) => e.id === data.eventId)
          if (evt) {
            setBookmarks((prev) => [
              {
                id: res.bookmark.id,
                eventId: res.bookmark.eventId,
                createdAt: res.bookmark.createdAt,
                event: evt,
              },
              ...prev,
            ])
          }
        }
      } catch (e) {
        toast.error('Failed to create bookmark', {
          description: e instanceof Error ? e.message : 'Unknown',
        })
        throw e
      }
    },
    [],
  )

  const deleteBookmark = useCallback(async (id: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id))
    try {
      await api.bookmarks.delete(id)
    } catch (e) {
      toast.error('Failed to delete bookmark', {
        description: e instanceof Error ? e.message : 'Unknown',
      })
      throw e
    }
  }, [])

  const deleteBookmarkByEvent = useCallback(async (eventId: string) => {
    setBookmarks((prev) => prev.filter((b) => b.eventId !== eventId))
    try {
      await api.bookmarks.deleteByEvent(eventId)
    } catch (e) {
      toast.error('Failed to delete bookmark', {
        description: e instanceof Error ? e.message : 'Unknown',
      })
      throw e
    }
  }, [])

  const updateSettings = useCallback(async (data: SettingsData) => {
    try {
      const res = await api.settings.update(data)
      setSettings(res.settings)
    } catch (e) {
      toast.error('Failed to update settings', {
        description: e instanceof Error ? e.message : 'Unknown',
      })
      throw e
    }
  }, [])

  return (
    <DataContext.Provider
      value={{
        events,
        categories,
        countdowns,
        bookmarks,
        settings,
        loading,
        error,
        refresh: fetchAll,
        refreshEvents,
        refreshCategories,
        refreshCountdowns,
        refreshBookmarks,
        refreshSettings,
        upsertEvent,
        deleteEvent,
        createCategory,
        deleteCategory,
        createCountdown,
        deleteCountdown,
        createBookmark,
        deleteBookmark,
        deleteBookmarkByEvent,
        updateSettings,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within a DataProvider')
  return ctx
}

export function useEvents() {
  const { events, loading, upsertEvent, deleteEvent, refreshEvents } = useData()
  return { events, loading, upsertEvent, deleteEvent, refreshEvents }
}

export function useCategories() {
  const {
    categories,
    loading,
    createCategory,
    deleteCategory,
    refreshCategories,
  } = useData()
  return {
    categories,
    loading,
    createCategory,
    deleteCategory,
    refreshCategories,
  }
}

export function useCountdowns() {
  const {
    countdowns,
    loading,
    createCountdown,
    deleteCountdown,
    refreshCountdowns,
  } = useData()
  return {
    countdowns,
    loading,
    createCountdown,
    deleteCountdown,
    refreshCountdowns,
  }
}

export function useBookmarks() {
  const {
    bookmarks,
    loading,
    createBookmark,
    deleteBookmark,
    deleteBookmarkByEvent,
    refreshBookmarks,
  } = useData()
  return {
    bookmarks,
    loading,
    createBookmark,
    deleteBookmark,
    deleteBookmarkByEvent,
    refreshBookmarks,
  }
}

export function useSettings() {
  const { settings, loading, updateSettings, refreshSettings } = useData()
  return { settings, loading, updateSettings, refreshSettings }
}
