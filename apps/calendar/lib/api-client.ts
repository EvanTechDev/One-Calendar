import { fetchJson } from '@/lib/fetch-json'

export const SHARE_LIST_KEY = '/api/share/list'

export type EventData = {
  id: string
  userId: string
  title: string
  description: string | null
  location: string | null
  startDate: string
  endDate: string
  isAllDay: boolean
  color: string | null
  categoryId: string | null
  participants: Array<{ name: string; email?: string; userId?: string }> | null
  notificationMinutes: number | null
  createdAt: string
  updatedAt: string
}

export type CategoryData = {
  id: string
  userId: string
  name: string
  color: string
  sortOrder: number
  createdAt: string
}

export type CountdownData = {
  id: string
  userId: string
  name: string
  targetDate: string
  repeat: 'none' | 'weekly' | 'monthly' | 'yearly'
  description: string | null
  color: string | null
  icon: string | null
  createdAt: string
}

export type BookmarkData = {
  id: string
  eventId: string
  createdAt: string
  event: EventData
}

export type ShareData = {
  id: string
  eventId: string
  eventTitle: string
  sharedBy: string
  shareDate: string
  shareLink: string
  isProtected: boolean
}

export type SettingsData = {
  language?: string
  firstDayOfWeek?: number
  timezone?: string
  defaultView?: 'day' | 'week' | 'month' | 'year' | 'four-day'
  timeFormat?: '24h' | '12h'
  theme?: 'light' | 'dark' | 'system'
  enableShortcuts?: boolean
  notificationSound?: string
  toastPosition?: string
  skipLanding?: boolean
  todayToast?: string | null
}

export const api = {
  events: {
    list: (params?: {
      startDate?: string
      endDate?: string
      categoryIds?: string
    }) => {
      const searchParams = new URLSearchParams()
      if (params?.startDate) searchParams.set('startDate', params.startDate)
      if (params?.endDate) searchParams.set('endDate', params.endDate)
      if (params?.categoryIds)
        searchParams.set('categoryIds', params.categoryIds)
      const qs = searchParams.toString()
      return fetchJson<{ events: EventData[] }>(
        `/api/events${qs ? `?${qs}` : ''}`,
      )
    },
    create: (data: {
      id?: string
      title: string
      description?: string | null
      location?: string | null
      startDate: string
      endDate: string
      isAllDay?: boolean
      color?: string | null
      categoryId?: string | null
      participants?: Array<{
        name: string
        email?: string
        userId?: string
      }> | null
      notificationMinutes?: number | null
    }) =>
      fetchJson<{ event: EventData }>('/api/events', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchJson<{ success: boolean }>('/api/events', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      }),
  },

  settings: {
    get: () => fetchJson<{ settings: SettingsData }>('/api/settings'),
    update: (data: SettingsData) =>
      fetchJson<{ success: boolean; settings: SettingsData }>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  categories: {
    list: () => fetchJson<{ categories: CategoryData[] }>('/api/categories'),
    create: (data: {
      id?: string
      name: string
      color: string
      sortOrder?: number
    }) =>
      fetchJson<{ category: CategoryData }>('/api/categories', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchJson<{ success: boolean }>('/api/categories', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      }),
  },

  countdowns: {
    list: () => fetchJson<{ countdowns: CountdownData[] }>('/api/countdowns'),
    create: (data: {
      id?: string
      name: string
      targetDate: string
      repeat?: 'none' | 'weekly' | 'monthly' | 'yearly'
      description?: string | null
      color?: string | null
      icon?: string | null
    }) =>
      fetchJson<{ countdown: CountdownData }>('/api/countdowns', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchJson<{ success: boolean }>('/api/countdowns', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      }),
  },

  bookmarks: {
    list: () => fetchJson<{ bookmarks: BookmarkData[] }>('/api/bookmarks'),
    create: (data: { id?: string; eventId: string }) =>
      fetchJson<{ bookmark: BookmarkData }>('/api/bookmarks', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchJson<{ success: boolean }>('/api/bookmarks', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      }),
    deleteByEvent: (eventId: string) =>
      fetchJson<{ success: boolean }>('/api/bookmarks', {
        method: 'DELETE',
        body: JSON.stringify({ eventId }),
      }),
  },

  shares: {
    list: () => fetchJson<{ shares: ShareData[] }>(SHARE_LIST_KEY),
    create: (data: {
      eventId: string
      password?: string
      burnAfterRead?: boolean
    }) =>
      fetchJson<{
        success: boolean
        id: string
        protected: boolean
        burnAfterRead: boolean
        shareLink: string
      }>('/api/share', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    get: (id: string, password?: string) => {
      const searchParams = new URLSearchParams({ id })
      if (password) searchParams.set('password', password)
      return fetchJson<{
        success: boolean
        data: string
        createdAt: string
        protected: boolean
        burnAfterRead: boolean
      }>(`/api/share?${searchParams.toString()}`)
    },
    delete: (id: string) =>
      fetchJson<{ success: boolean }>('/api/share', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      }),
  },
}
