/**
 * The calendar app's implementation of @zntr/agent's CalendarToolkit port,
 * built from the SAME userId-scoped functions the MCP server exposes
 * (lib/mcp/*-tools.ts). The AI command palette and an external MCP client
 * therefore act through one code path: cache invalidation, field
 * encryption, reminder reconciliation and recurrence handling all come for
 * free and cannot drift.
 *
 * A toolkit instance is created per authenticated request and closes over
 * the userId — the agent package never sees user identity.
 */
import {
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} from '@/lib/mcp/event-tools'
import { listCategories } from '@/lib/mcp/category-tools'
import { getAnalyticsSummary } from '@/lib/mcp/analytics-tools'
import { getSettings } from '@/lib/mcp/settings-tools'
import {
  bookmarkEvent,
  listBookmarkedEvents,
  removeBookmark,
} from '@/lib/mcp/bookmark-tools'
import {
  createCountdown,
  deleteCountdown,
  listCountdowns,
} from '@/lib/mcp/countdown-tools'
import { COLOR_HEX_VALUES } from '@/lib/mcp/colors'
import { DEFAULT_COUNTDOWN_ICON } from '@/lib/countdown-icons'
import type {
  AgentAnalyticsSummary,
  AgentEventSummary,
  CalendarToolkit,
} from '@zntr/agent/types'

const DEFAULT_EVENT_COLOR = COLOR_HEX_VALUES[0]

interface ToolEventRow {
  id: string
  title: string
  description?: string | null
  location?: string | null
  startDate: Date | string
  endDate: Date | string
  isAllDay?: boolean | null
  status?: string | null
  color?: string | null
  categoryId?: string | null
  recurrenceSummary?: string | null
  instanceId?: string
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value
}

function toSummary(row: ToolEventRow): AgentEventSummary {
  return {
    // Prefer the instance id: for a recurring occurrence it is the only
    // handle update/delete tools can act on.
    id: row.instanceId ?? row.id,
    title: row.title,
    description: row.description ?? null,
    location: row.location ?? null,
    startDate: toIso(row.startDate),
    endDate: toIso(row.endDate),
    isAllDay: row.isAllDay ?? false,
    status: row.status ?? null,
    color: row.color ?? null,
    categoryId: row.categoryId ?? null,
    recurrenceSummary: row.recurrenceSummary ?? null,
  }
}

export function createAppToolkit(userId: string): CalendarToolkit {
  return {
    async listEvents(input) {
      // Presets were already resolved to instants in @zntr/agent/presets.
      const events = await listEvents(userId, {
        filter: {
          time: { start: input.start, end: input.end },
          category_ids: input.categoryIds,
        },
        ...(input.query ? { search: { text: input.query } } : {}),
        pagination: { page: 1, limit: input.limit ?? 20 },
        sort: { field: 'start_date', direction: 'asc' },
      })
      return (events.events as unknown as ToolEventRow[]).map(toSummary)
    },

    async createEvent(input) {
      const created = await createEvent(userId, {
        title: input.title,
        description: input.description ?? null,
        location: input.location ?? null,
        start_date: input.start,
        end_date: input.end,
        is_all_day: input.isAllDay ?? false,
        color: input.color ?? DEFAULT_EVENT_COLOR,
        category_id: input.categoryId ?? null,
        rrule: input.rrule ?? null,
      })
      return toSummary(created as unknown as ToolEventRow)
    },

    async updateEvent(input) {
      const updated = await updateEvent(userId, input.eventId, {
        title: input.title,
        description: input.description,
        location: input.location,
        start_date: input.start,
        end_date: input.end,
        is_all_day: input.isAllDay,
        color: input.color,
        category_id: input.categoryId,
        rrule: input.rrule,
        apply_to: input.applyTo,
      })
      if (!updated) return null
      return toSummary(updated as unknown as ToolEventRow)
    },

    async deleteEvent(input) {
      await deleteEvent(userId, input.eventId, input.applyTo)
    },

    async listCategories() {
      const categories = await listCategories(userId)
      return categories.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
      }))
    },

    async getAnalyticsSummary(input) {
      const summary = await getAnalyticsSummary(userId, {
        start_date: input.start,
        end_date: input.end,
        include_category_names: true,
      })
      return summary as unknown as AgentAnalyticsSummary
    },

    async getTimezone() {
      const settings = await getSettings(userId)
      const timezone = (settings as Record<string, unknown>).timezone
      return typeof timezone === 'string' && timezone.length > 0
        ? timezone
        : 'UTC'
    },

    async listBookmarks() {
      const { bookmarks } = await listBookmarkedEvents(userId, { limit: 50 })
      return bookmarks.map((b) => {
        const event = b.event as {
          title?: string
          startDate?: Date | string
        } | null
        return {
          id: b.id,
          eventId: b.eventId,
          eventTitle: event?.title ?? null,
          eventStartDate: event?.startDate ? toIso(event.startDate) : null,
        }
      })
    },

    async bookmarkEvent(input) {
      const row = await bookmarkEvent(userId, { eventId: input.eventId })
      return { id: row.id, eventId: row.eventId }
    },

    async removeBookmark(input) {
      await removeBookmark(userId, { eventId: input.eventId })
    },

    async listCountdowns() {
      const { items } = await listCountdowns(userId, 1, 50)
      return items.map((c) => ({
        id: c.id,
        name: c.name,
        targetDate: toIso(c.targetDate),
        description: c.description ?? null,
        color: c.color ?? null,
        icon: c.icon ?? null,
      }))
    },

    async createCountdown(input) {
      const created = await createCountdown(userId, {
        name: input.name,
        target_date: input.targetDate,
        description: input.description ?? null,
        color: input.color ?? COLOR_HEX_VALUES[0],
        icon: DEFAULT_COUNTDOWN_ICON,
      })
      return {
        id: created.id,
        name: created.name,
        targetDate: toIso(created.targetDate),
        description: created.description ?? null,
        color: created.color ?? null,
        icon: created.icon ?? null,
      }
    },

    async deleteCountdown(input) {
      await deleteCountdown(userId, input.countdownId)
    },
  }
}
