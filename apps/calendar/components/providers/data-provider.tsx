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
import {
  adaptRuleToStart,
  addWallClockDays,
  canTranslateRuleByDays,
  defaultExpansionWindow,
  expandSeriesView,
  isInstanceId,
  optimisticFollowingSplit,
  parseInstanceId,
  parseRfcStamp,
  shiftExdates,
  shiftToAnchorClock,
  snapToPatternDay,
  translateRuleByDays,
  translateStampsByDays,
  wallClockDayDelta,
  type SeriesViewInput,
} from '@/lib/recurrence/engine'

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
    oldSeriesIds?: Set<string>,
  ) => Promise<EventData>
  deleteEvent: (
    id: string,
    applyTo?: 'single' | 'following' | 'all',
    timezone?: string,
    opts?: { deferNetwork?: boolean },
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
  const eventsReq = useSWR(DATA_KEYS.events, () =>
    api.events.list({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  )
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
    async (
      data: Parameters<typeof api.events.create>[0],
      oldSeriesIds?: Set<string>,
    ) => {
      try {
        // A "this and following" split orphans the old series: the server
        // truncates it, and when nothing survives before the split point
        // (root-instance split, or every earlier instance was exdated) the
        // response's seriesEvents contains no row for it at all. Purging
        // therefore cannot rely on inference from the payload — derive the
        // old series id from the cache so a caller forgetting oldSeriesIds
        // can never leave ghost instances behind.
        const purgeSeriesIds = new Set<string>(oldSeriesIds ?? [])
        if (data.apply_to === 'following' && data.id) {
          const cached = eventsRef.current.find((e) => e.id === data.id)
          if (cached?.seriesId) {
            purgeSeriesIds.add(cached.seriesId)
          } else {
            const parsed = isInstanceId(data.id)
              ? parseInstanceId(data.id)
              : null
            if (parsed) purgeSeriesIds.add(parsed.seriesId)
            else if (cached?.rrule) purgeSeriesIds.add(cached.id)
          }
        }
        const purge = purgeSeriesIds.size > 0 ? purgeSeriesIds : undefined

        let optimistic: EventData[] | null = null
        if (
          data.id &&
          (data.apply_to === undefined || data.apply_to === 'all')
        ) {
          optimistic = optimisticSeries(data, eventsRef.current)
        } else if (data.apply_to === 'following' && data.split_id && data.id) {
          const target = eventsRef.current.find((e) => e.id === data.id)
          if (target?.seriesId && target.recurrenceId) {
            const window = defaultExpansionWindow()
            // Mirror the server's planInstanceChange: a "this and following"
            // save never violates the parent pattern, so the new anchor snaps
            // back to the dragged occurrence's day and keeps only its new
            // time of day (all-day moves have no clock to adopt).
            const allDay = data.isAllDay ?? target.isAllDay
            const requestedStart = new Date(data.startDate)
            const requestedEnd = new Date(data.endDate)
            const anchorStart = allDay
              ? requestedStart
              : snapToPatternDay(
                  parseRfcStamp(target.recurrenceId).date,
                  requestedStart,
                  data.timezone,
                )
            const anchorEnd = allDay
              ? requestedEnd
              : new Date(
                  anchorStart.getTime() +
                    (requestedEnd.getTime() - requestedStart.getTime()),
                )
            const nextMaster: EventData = {
              ...target,
              id: data.split_id,
              seriesId: null,
              recurrenceId: null,
              title: data.title ?? target.title,
              startDate: anchorStart.toISOString(),
              endDate: anchorEnd.toISOString(),
              isAllDay: data.isAllDay ?? target.isAllDay,
              color: data.color ?? target.color,
              categoryId: data.categoryId ?? target.categoryId,
              description: data.description ?? target.description,
              location: data.location ?? target.location,
              notificationMinutes:
                data.notificationMinutes ?? target.notificationMinutes,
              participants: data.participants ?? target.participants,
              rrule: data.rrule ?? target.rrule ?? null,
            }
            optimistic = optimisticFollowingSplit(
              eventsRef.current,
              target,
              nextMaster,
              window.windowStart,
              window.windowEnd,
              undefined,
              data.timezone,
            )
          }
        }
        if (optimistic) {
          await mutate(
            DATA_KEYS.events,
            (cur?: { events: EventData[] }) => ({
              events: replaceSeriesInstances(
                cur?.events ?? [],
                optimistic,
                purge,
              ),
            }),
            { revalidate: false },
          )
        }
        const res = await api.events.create(data)
        // The event saved, but its reminder emails were refused on quota. Say so
        // rather than leaving the checkbox looking effective — see
        // ADR-0010 (email reminders are opt-in per event and scheduled through Resend).
        if (res.reminderWarning) toast.warning(res.reminderWarning)
        for (const id of res.removedSeriesIds ?? []) purgeSeriesIds.add(id)
        const seriesEvents = res.seriesEvents
        if (seriesEvents && seriesEvents.length > 0) {
          await mutate(
            DATA_KEYS.events,
            (cur?: { events: EventData[] }) => ({
              events: replaceSeriesInstances(
                cur?.events ?? [],
                seriesEvents,
                purgeSeriesIds.size > 0 ? purgeSeriesIds : undefined,
              ),
            }),
            { revalidate: false },
          )
        } else if (res.event?.rrule) {
          // A series master row must never enter the expanded-view cache —
          // it would render as a standalone duplicate of the series' first
          // instance. Without seriesEvents there is nothing safe to apply
          // locally, so fall back to server truth.
          await mutate(DATA_KEYS.events)
        } else {
          await mutate(
            DATA_KEYS.events,
            (cur?: { events: EventData[] }) => ({
              events: upsertById(cur?.events ?? [], res.event),
            }),
            { revalidate: false },
          )
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
    async (
      id: string,
      applyTo?: 'single' | 'following' | 'all',
      timezone?: string,
      opts?: { deferNetwork?: boolean },
    ) => {
      const prev = eventsRef.current
      const target = prev.find((e) => e.id === id)
      const seriesId = target?.seriesId
      const recurrenceId = target?.recurrenceId
      let optimistic: EventData[] = removeById(prev, id)
      if (seriesId) {
        if (applyTo === 'all') {
          optimistic = prev.filter((e) => e.seriesId !== seriesId)
        } else if (applyTo === 'following' && recurrenceId) {
          optimistic = prev.filter(
            (e) =>
              e.seriesId !== seriesId || (e.recurrenceId ?? '') < recurrenceId,
          )
        }
      }
      await mutate(
        DATA_KEYS.events,
        { events: optimistic },
        { revalidate: false },
      )
      if (opts?.deferNetwork) return
      try {
        const res = await api.events.delete(id, applyTo, timezone)
        const seriesEvents = res.seriesEvents
        if (seriesEvents && seriesEvents.length > 0) {
          await mutate(
            DATA_KEYS.events,
            (cur?: { events: EventData[] }) => ({
              events: replaceSeriesInstances(cur?.events ?? [], seriesEvents),
            }),
            { revalidate: false },
          )
        }
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

function replaceSeriesInstances(
  events: EventData[],
  incoming: EventData[],
  oldSeriesIds?: Set<string>,
): EventData[] {
  if (incoming.length === 0 && !oldSeriesIds?.size) return events
  const seriesIds = new Set<string>()
  const ids = new Set<string>()
  for (const e of incoming) {
    if (e.seriesId) seriesIds.add(e.seriesId)
    else ids.add(e.id)
  }
  const kept = events.filter((e) => {
    if (e.seriesId && seriesIds.has(e.seriesId)) return false
    // Purge by series membership for instances — and by the row's own id
    // for raw master rows, whose "series id" is their id (seriesId null).
    if (oldSeriesIds?.size) {
      if (e.seriesId && oldSeriesIds.has(e.seriesId)) return false
      if (!e.seriesId && oldSeriesIds.has(e.id)) return false
    }
    return !ids.has(e.id)
  })
  return [...kept, ...incoming]
}

export function optimisticSeries(
  data: Parameters<typeof api.events.create>[0],
  current: EventData[],
): EventData[] | null {
  const target = current.find((e) => e.id === data.id)
  const parsedId =
    data.id && isInstanceId(data.id) ? parseInstanceId(data.id) : null
  const key = target?.seriesId ?? parsedId?.seriesId ?? (data.id as string)
  const currentMaster = current.find((e) => e.id === key && e.seriesId === null)
  const rule = data.rrule ?? currentMaster?.rrule ?? target?.rrule ?? null
  if (!rule) return null
  const inputStart = new Date(data.startDate)
  const inputEnd = new Date(data.endDate)
  const prevStart = parsedId ? parseRfcStamp(parsedId.recurrenceId).date : null
  // "All events" translates the whole pattern by the move's day distance
  // (mirrors the server): Mon → Tue turns Mon/Wed/Fri/Sun into
  // Tue/Thu/Sat/Mon. A same-day move is a pure clock change (delta 0).
  const dayDelta = wallClockDayDelta(
    prevStart ??
      (currentMaster ? new Date(currentMaster.startDate) : inputStart),
    inputStart,
  )
  // The server refuses a day move this rule cannot express (e.g. "last day
  // of the month"); skip the optimistic paint so the UI does not flash a
  // state that is about to be rejected.
  if (dayDelta !== 0 && !canTranslateRuleByDays(rule, dayDelta)) return null
  const clampedStart = currentMaster
    ? shiftToAnchorClock(new Date(currentMaster.startDate), inputStart)
    : inputStart
  const anchorStart =
    dayDelta !== 0 && currentMaster
      ? addWallClockDays(clampedStart, dayDelta)
      : clampedStart
  const startDate = anchorStart.toISOString()
  const endDate = new Date(
    anchorStart.getTime() + (inputEnd.getTime() - inputStart.getTime()),
  ).toISOString()
  const master: SeriesViewInput = {
    ...(currentMaster as unknown as SeriesViewInput | undefined),
    id: key,
    seriesId: null,
    recurrenceId: null,
    title: data.title ?? currentMaster?.title ?? '',
    description: data.description ?? currentMaster?.description ?? null,
    location: data.location ?? currentMaster?.location ?? null,
    startDate,
    endDate,
    isAllDay: data.isAllDay ?? currentMaster?.isAllDay ?? false,
    color: data.color ?? currentMaster?.color ?? null,
    categoryId: data.categoryId ?? currentMaster?.categoryId ?? null,
    notificationMinutes:
      data.notificationMinutes ?? currentMaster?.notificationMinutes ?? null,
    participants: data.participants ?? currentMaster?.participants ?? null,
    rrule:
      prevStart !== null
        ? adaptRuleToStart(
            dayDelta !== 0
              ? translateRuleByDays(
                  rule,
                  dayDelta,
                  anchorStart,
                  data.isAllDay ?? false,
                )
              : rule,
            prevStart,
            anchorStart,
            data.isAllDay ?? false,
          )
        : rule,
    // The expanded-view cache holds no raw master row, so fall back to the
    // clicked instance's inherited exdate: it carries the series' exclusions
    // (including a split's boundary exdate) and without it an inclusive UNTIL
    // would re-expand the series one occurrence past its real end.
    exdate:
      dayDelta !== 0
        ? translateStampsByDays(
            currentMaster ? currentMaster.exdate : target?.exdate,
            dayDelta,
            inputStart,
          )
        : currentMaster
          ? shiftExdates(currentMaster.exdate, inputStart)
          : (shiftExdates(target?.exdate, inputStart) ?? data.exdate ?? null),
  }
  // Only single-instance overrides (isOverride rows) carry custom times that
  // must survive a series-wide time change. Their recurrence stamp follows
  // the series into the new clock space (like the server's remapOverridesClock)
  // but their stored time stays untouched, so the override keeps matching its
  // regenerated occurrence instead of resurfacing as an orphan duplicate.
  // Master edits shift by an unknown delta, so they skip overrides entirely
  // and let the server response reconcile them.
  const anchorStamp = parsedId?.recurrenceId ?? null
  const overrides =
    prevStart === null || anchorStamp === null
      ? []
      : current
          .filter(
            (e) =>
              e.seriesId === key &&
              e.isOverride &&
              e.recurrenceId !== null &&
              e.recurrenceId !== undefined &&
              e.recurrenceId >= anchorStamp &&
              e.id !== data.id,
          )
          .map((e) => ({
            ...e,
            recurrenceId:
              dayDelta !== 0
                ? translateStampsByDays(
                    [e.recurrenceId!],
                    dayDelta,
                    inputStart,
                  )![0]
                : shiftExdates([e.recurrenceId!], inputStart)![0],
          }))
  const window = defaultExpansionWindow()
  const expanded = expandSeriesView(
    [master],
    overrides as unknown as SeriesViewInput[],
    window.windowStart,
    window.windowEnd,
  ) as unknown as EventData[]
  if (prevStart === null || anchorStamp === null) return expanded
  const keptEarly = current
    .filter(
      (e) =>
        e.seriesId === key &&
        e.recurrenceId !== null &&
        e.recurrenceId !== undefined &&
        e.recurrenceId < anchorStamp,
    )
    .map((e) => {
      if (e.isOverride) return e
      const originalStart = new Date(e.startDate)
      const clocked = shiftToAnchorClock(originalStart, inputStart)
      // Earlier instances travel with the pattern too when the move crossed
      // days, so the optimistic view matches what the translated rule will
      // regenerate.
      const start =
        dayDelta !== 0 ? addWallClockDays(clocked, dayDelta) : clocked
      if (start.getTime() === originalStart.getTime()) return e
      const duration = new Date(e.endDate).getTime() - originalStart.getTime()
      return {
        ...e,
        startDate: start.toISOString(),
        endDate: new Date(start.getTime() + duration).toISOString(),
      }
    })
  return [...keptEarly, ...expanded]
}
