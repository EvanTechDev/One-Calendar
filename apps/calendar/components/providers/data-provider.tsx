'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react'
import useSWR, { mutate } from 'swr'
import {
  api,
  type EventData,
  type CategoryData,
  type CountdownData,
  type BookmarkData,
  type SettingsData,
} from '@/lib/api-client'
import { toast } from 'sonner'
import { removeById, upsertById, upsertBy } from '@/lib/array-mutations'

type LoadingState = 'loading' | 'loaded' | 'error'

// Keys are the API URLs — the global SWR cache dedupes across remounts,
// so re-entering the app or switching tabs within a session reuses cached data.
export const DATA_KEYS = {
  events: '/api/events',
  categories: '/api/categories',
  countdowns: '/api/countdowns',
  bookmarks: '/api/bookmarks',
  settings: '/api/settings',
} as const

interface DataContextValue {
  events: EventData[]
  categories: CategoryData[]
  countdowns: CountdownData[]
  bookmarks: BookmarkData[]
  settings: SettingsData
  loading: LoadingState
  error: string | null
  eventsLoaded: boolean
  categoriesLoaded: boolean

  refresh: () => Promise<void>
  refreshEvents: () => Promise<void>
  refreshCategories: () => Promise<void>
  refreshCountdowns: () => Promise<void>
  refreshBookmarks: () => Promise<void>
  refreshSettings: () => Promise<void>

  upsertEvent: (
    data: Parameters<typeof api.events.create>[0],
  ) => Promise<EventData>
  deleteEvent: (
    id: string,
    applyTo?: 'single' | 'following' | 'all',
  ) => Promise<void>

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
  const eventsReq = useSWR(DATA_KEYS.events, () => api.events.list())
  const categoriesReq = useSWR(DATA_KEYS.categories, () =>
    api.categories.list(),
  )
  const countdownsReq = useSWR(DATA_KEYS.countdowns, () =>
    api.countdowns.list(),
  )
  const bookmarksReq = useSWR(DATA_KEYS.bookmarks, () => api.bookmarks.list())
  const settingsReq = useSWR(DATA_KEYS.settings, () => api.settings.get())

  const events = eventsReq.data?.events ?? []
  const categories = categoriesReq.data?.categories ?? []
  const countdowns = countdownsReq.data?.countdowns ?? []
  const bookmarks = bookmarksReq.data?.bookmarks ?? []
  const settings = settingsReq.data?.settings ?? {}

  const requests = [
    eventsReq,
    categoriesReq,
    countdownsReq,
    bookmarksReq,
    settingsReq,
  ]
  const settled = requests.every((r) => r.data !== undefined || r.error)
  const failed = requests.filter((r) => r.error && r.data === undefined)
  const loading: LoadingState = settled
    ? failed.length > 0
      ? 'error'
      : 'loaded'
    : 'loading'
  const error =
    failed[0]?.error instanceof Error ? failed[0].error.message : null
  const eventsLoaded =
    eventsReq.data !== undefined || eventsReq.error !== undefined
  const categoriesLoaded =
    categoriesReq.data !== undefined || categoriesReq.error !== undefined

  const eventsRef = useRef(events)
  eventsRef.current = events
  const categoriesRef = useRef(categories)
  categoriesRef.current = categories
  const countdownsRef = useRef(countdowns)
  countdownsRef.current = countdowns
  const bookmarksRef = useRef(bookmarks)
  bookmarksRef.current = bookmarks

  const refreshEvents = useCallback(
    () => mutate(DATA_KEYS.events).then(() => undefined),
    [],
  )
  const refreshCategories = useCallback(
    () => mutate(DATA_KEYS.categories).then(() => undefined),
    [],
  )
  const refreshCountdowns = useCallback(
    () => mutate(DATA_KEYS.countdowns).then(() => undefined),
    [],
  )
  const refreshBookmarks = useCallback(
    () => mutate(DATA_KEYS.bookmarks).then(() => undefined),
    [],
  )
  const refreshSettings = useCallback(
    () => mutate(DATA_KEYS.settings).then(() => undefined),
    [],
  )

  const refresh = useCallback(
    () =>
      Promise.all([
        refreshEvents(),
        refreshCategories(),
        refreshCountdowns(),
        refreshBookmarks(),
        refreshSettings(),
      ]).then(() => undefined),
    [
      refreshEvents,
      refreshCategories,
      refreshCountdowns,
      refreshBookmarks,
      refreshSettings,
    ],
  )

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
        await mutate(
          DATA_KEYS.events,
          (cur?: { events: EventData[] }) =>
            cur ? { events: upsertById(cur.events, res.event) } : cur,
          { revalidate: false },
        )
        if (
          data.rrule ||
          data.apply_to === 'following' ||
          data.apply_to === 'all'
        ) {
          await mutate(DATA_KEYS.events).catch(() => undefined)
        }
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

  const deleteEvent = useCallback(
    async (id: string, applyTo?: 'single' | 'following' | 'all') => {
      const prev = eventsRef.current
      await mutate(
        DATA_KEYS.events,
        { events: removeById(prev, id) },
        { revalidate: false },
      )
      try {
        await api.events.delete(id, applyTo)
        await mutate(DATA_KEYS.events).catch(() => undefined)
      } catch (e) {
        await mutate(DATA_KEYS.events, { events: prev }, { revalidate: false })
        toast.error('Failed to delete event', {
          description: e instanceof Error ? e.message : 'Unknown',
        })
        throw e
      }
    },
    [],
  )

  const createCategory = useCallback(
    async (data: Parameters<typeof api.categories.create>[0]) => {
      try {
        const res = await api.categories.create(data)
        await mutate(
          DATA_KEYS.categories,
          (cur?: { categories: CategoryData[] }) =>
            cur
              ? { categories: upsertById(cur.categories, res.category) }
              : cur,
          { revalidate: false },
        )
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
    const prev = categoriesRef.current
    await mutate(
      DATA_KEYS.categories,
      { categories: removeById(prev, id) },
      { revalidate: false },
    )
    try {
      await api.categories.delete(id)
    } catch (e) {
      await mutate(
        DATA_KEYS.categories,
        { categories: prev },
        { revalidate: false },
      )
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
        await mutate(
          DATA_KEYS.countdowns,
          (cur?: { countdowns: CountdownData[] }) =>
            cur
              ? { countdowns: upsertById(cur.countdowns, res.countdown) }
              : cur,
          { revalidate: false },
        )
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
    const prev = countdownsRef.current
    await mutate(
      DATA_KEYS.countdowns,
      { countdowns: removeById(prev, id) },
      { revalidate: false },
    )
    try {
      await api.countdowns.delete(id)
    } catch (e) {
      await mutate(
        DATA_KEYS.countdowns,
        { countdowns: prev },
        { revalidate: false },
      )
      toast.error('Failed to delete countdown', {
        description: e instanceof Error ? e.message : 'Unknown',
      })
      throw e
    }
  }, [])

  const createBookmark = useCallback(
    async (data: Parameters<typeof api.bookmarks.create>[0]) => {
      try {
        const res = await api.bookmarks.create(data)
        if (res.bookmark) {
          const evt = eventsRef.current.find((e) => e.id === data.eventId)
          if (evt) {
            const item = {
              id: res.bookmark.id,
              eventId: res.bookmark.eventId,
              createdAt: res.bookmark.createdAt,
              event: evt,
            }
            await mutate(
              DATA_KEYS.bookmarks,
              (cur?: { bookmarks: BookmarkData[] }) => ({
                bookmarks: upsertBy(
                  cur?.bookmarks ?? [],
                  item,
                  (b) => b.eventId === item.eventId,
                ),
              }),
              { revalidate: false },
            )
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
    const prev = bookmarksRef.current
    await mutate(
      DATA_KEYS.bookmarks,
      { bookmarks: removeById(prev, id) },
      { revalidate: false },
    )
    try {
      await api.bookmarks.delete(id)
    } catch (e) {
      await mutate(
        DATA_KEYS.bookmarks,
        { bookmarks: prev },
        { revalidate: false },
      )
      toast.error('Failed to delete bookmark', {
        description: e instanceof Error ? e.message : 'Unknown',
      })
      throw e
    }
  }, [])

  const deleteBookmarkByEvent = useCallback(async (eventId: string) => {
    const prev = bookmarksRef.current
    await mutate(
      DATA_KEYS.bookmarks,
      { bookmarks: prev.filter((b) => b.eventId !== eventId) },
      { revalidate: false },
    )
    try {
      await api.bookmarks.deleteByEvent(eventId)
    } catch (e) {
      await mutate(
        DATA_KEYS.bookmarks,
        { bookmarks: prev },
        { revalidate: false },
      )
      toast.error('Failed to delete bookmark', {
        description: e instanceof Error ? e.message : 'Unknown',
      })
      throw e
    }
  }, [])

  const updateSettings = useCallback(async (data: SettingsData) => {
    try {
      const res = await api.settings.update(data)
      await mutate(
        DATA_KEYS.settings,
        { settings: res.settings },
        { revalidate: false },
      )
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
        eventsLoaded,
        categoriesLoaded,
        refresh,
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
