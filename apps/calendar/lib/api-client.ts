import { fetchJson } from '@/lib/fetch-json'

export type EventInviteData = {
  id: string
  email: string
  status: 'pending' | 'accepted' | 'maybe' | 'declined'
  inviteToken: string
  emailSent: boolean
  addedToCalendar: boolean
  userName: string | null
  userImage: string | null
}

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
  rrule?: string | null
  exdate?: string[] | null
  seriesId?: string | null
  recurrenceId?: string | null
  isOverride?: boolean
  isFirstInstance?: boolean
  createdAt: string
  updatedAt: string
  viewOnly?: boolean
  organizer?: {
    name: string
    email: string
    image: string | null
  } | null
  invites?: EventInviteData[]
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
      timezone?: string
    }) => {
      const searchParams = new URLSearchParams()
      if (params?.startDate) searchParams.set('startDate', params.startDate)
      if (params?.endDate) searchParams.set('endDate', params.endDate)
      if (params?.categoryIds)
        searchParams.set('categoryIds', params.categoryIds)
      if (params?.timezone) searchParams.set('tz', params.timezone)
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
      rrule?: string | null
      exdate?: string[] | null
      apply_to?: 'single' | 'following' | 'all'
      split_id?: string
      timezone?: string
    }) =>
      fetchJson<{
        event: EventData
        seriesEvents?: EventData[]
        /**
         * Series whose rendered instances must be purged from the local
         * cache. Sent after a "this and following" split: the truncated old
         * series can expand to zero in-window instances, leaving no trace of
         * itself in seriesEvents for the client to infer the purge from.
         */
        removedSeriesIds?: string[]
      }>('/api/events', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (
      id: string,
      applyTo?: 'single' | 'following' | 'all',
      timezone?: string,
    ) =>
      fetchJson<{ success: boolean; seriesEvents?: EventData[] }>(
        '/api/events',
        {
          method: 'DELETE',
          body: JSON.stringify({ id, apply_to: applyTo, timezone }),
        },
      ),
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
}
