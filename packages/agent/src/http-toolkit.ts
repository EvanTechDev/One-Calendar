/**
 * CalendarToolkit implemented against a RUNNING calendar app's REST API.
 *
 * This is the standalone eve runtime's binding (packages/agent/agent/).
 * The in-app API route uses the direct database toolkit in
 * apps/calendar/lib/agent/toolkit.ts instead — same port, richer backend.
 *
 * Auth: a session cookie captured from a signed-in browser session, passed
 * via CALENDAR_COOKIE. The agent never holds database credentials; every
 * authorization decision stays inside the app, which is the same trust
 * boundary the browser sits behind.
 */
import type { AgentCategory, AgentEventSummary, CalendarToolkit } from './types'

export interface HttpToolkitConfig {
  baseUrl: string
  cookie: string
}

export function configFromEnv(): HttpToolkitConfig | null {
  const baseUrl = process.env.CALENDAR_BASE_URL
  const cookie = process.env.CALENDAR_COOKIE
  if (!baseUrl || !cookie) return null
  return { baseUrl: baseUrl.replace(/\/$/, ''), cookie }
}

async function request<T>(
  config: HttpToolkitConfig,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      cookie: config.cookie,
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `Calendar API ${res.status} on ${path}: ${body.slice(0, 300)}`,
    )
  }
  return (await res.json()) as T
}

interface ApiEvent {
  id: string
  title: string
  description?: string | null
  location?: string | null
  startDate: string
  endDate: string
  isAllDay?: boolean
  status?: string | null
  color?: string | null
  categoryId?: string | null
  recurrenceSummary?: string | null
}

function toSummary(e: ApiEvent): AgentEventSummary {
  return {
    id: e.id,
    title: e.title,
    description: e.description ?? null,
    location: e.location ?? null,
    startDate: e.startDate,
    endDate: e.endDate,
    isAllDay: e.isAllDay ?? false,
    status: e.status ?? null,
    color: e.color ?? null,
    categoryId: e.categoryId ?? null,
    recurrenceSummary: e.recurrenceSummary ?? null,
  }
}

export function createHttpToolkit(config: HttpToolkitConfig): CalendarToolkit {
  return {
    async listEvents(input) {
      // Presets were already resolved to instants in ./presets.
      const params = new URLSearchParams()
      if (input.start) params.set('startDate', input.start)
      if (input.end) params.set('endDate', input.end)
      if (input.categoryIds?.length)
        params.set('categoryIds', input.categoryIds.join(','))
      const { events } = await request<{ events: ApiEvent[] }>(
        config,
        `/api/events?${params}`,
      )
      const query = input.query?.trim().toLowerCase()
      const filtered = query
        ? events.filter((e) =>
            [e.title, e.description, e.location]
              .filter(Boolean)
              .some((f) => String(f).toLowerCase().includes(query)),
          )
        : events
      return filtered.slice(0, input.limit ?? 20).map(toSummary)
    },

    async createEvent(input) {
      const { event } = await request<{ event: ApiEvent }>(
        config,
        '/api/events',
        {
          method: 'POST',
          body: JSON.stringify({
            title: input.title,
            description: input.description ?? null,
            location: input.location ?? null,
            startDate: input.start,
            endDate: input.end,
            isAllDay: input.isAllDay ?? false,
            categoryId: input.categoryId ?? null,
            color: input.color ?? null,
            rrule: input.rrule ?? null,
            exdate: null,
          }),
        },
      )
      return toSummary(event)
    },

    async updateEvent(input) {
      // The REST route treats POST-with-id as an update, but it requires the
      // full field set — so read-modify-write.
      const params = new URLSearchParams({ id: input.eventId })
      const { event: existing } = await request<{ event: ApiEvent }>(
        config,
        `/api/events?${params}`,
      )
      const { event } = await request<{ event: ApiEvent }>(
        config,
        '/api/events',
        {
          method: 'POST',
          body: JSON.stringify({
            id: input.eventId,
            title: input.title ?? existing.title,
            description: input.description ?? existing.description ?? null,
            location: input.location ?? existing.location ?? null,
            startDate: input.start ?? existing.startDate,
            endDate: input.end ?? existing.endDate,
            isAllDay: input.isAllDay ?? existing.isAllDay ?? false,
            categoryId: input.categoryId ?? existing.categoryId ?? null,
            color: input.color ?? existing.color ?? null,
            apply_to: input.applyTo ?? null,
          }),
        },
      )
      return toSummary(event)
    },

    async deleteEvent(input) {
      await request(config, '/api/events', {
        method: 'DELETE',
        body: JSON.stringify({
          id: input.eventId,
          apply_to: input.applyTo ?? null,
        }),
      })
    },

    async listCategories() {
      const { categories } = await request<{ categories: AgentCategory[] }>(
        config,
        '/api/categories',
      )
      return categories
    },

    async getAnalyticsSummary() {
      // The analytics engine has no public REST surface; the standalone
      // runtime reports that honestly rather than inventing numbers.
      throw new Error(
        'Schedule summaries are only available inside the calendar app',
      )
    },

    async getTimezone() {
      const { settings } = await request<{
        settings?: { timezone?: string }
      }>(config, '/api/settings')
      return settings?.timezone ?? 'UTC'
    },

    async listBookmarks() {
      const { bookmarks } = await request<{
        bookmarks: Array<{
          id: string
          eventId: string
          event?: { title?: string; startDate?: string } | null
        }>
      }>(config, '/api/bookmarks')
      return bookmarks.map((b) => ({
        id: b.id,
        eventId: b.eventId,
        eventTitle: b.event?.title ?? null,
        eventStartDate: b.event?.startDate ?? null,
      }))
    },

    async bookmarkEvent(input) {
      const { bookmark } = await request<{
        bookmark: { id: string; eventId: string }
      }>(config, '/api/bookmarks', {
        method: 'POST',
        body: JSON.stringify({ eventId: input.eventId }),
      })
      return { id: bookmark.id, eventId: bookmark.eventId }
    },

    async removeBookmark(input) {
      await request(config, '/api/bookmarks', {
        method: 'DELETE',
        body: JSON.stringify({ eventId: input.eventId }),
      })
    },

    async listCountdowns() {
      const { countdowns } = await request<{
        countdowns: Array<{
          id: string
          name: string
          targetDate: string
          description?: string | null
          color?: string | null
          icon?: string | null
        }>
      }>(config, '/api/countdowns')
      return countdowns.map((c) => ({
        id: c.id,
        name: c.name,
        targetDate: c.targetDate,
        description: c.description ?? null,
        color: c.color ?? null,
        icon: c.icon ?? null,
      }))
    },

    async createCountdown(input) {
      const { countdown } = await request<{
        countdown: {
          id: string
          name: string
          targetDate: string
          description?: string | null
          color?: string | null
          icon?: string | null
        }
      }>(config, '/api/countdowns', {
        method: 'POST',
        body: JSON.stringify({
          name: input.name,
          targetDate: input.targetDate,
          description: input.description ?? null,
          color: input.color ?? null,
        }),
      })
      return {
        id: countdown.id,
        name: countdown.name,
        targetDate: countdown.targetDate,
        description: countdown.description ?? null,
        color: countdown.color ?? null,
        icon: countdown.icon ?? null,
      }
    },

    async deleteCountdown(input) {
      await request(config, '/api/countdowns', {
        method: 'DELETE',
        body: JSON.stringify({ id: input.countdownId }),
      })
    },
  }
}
