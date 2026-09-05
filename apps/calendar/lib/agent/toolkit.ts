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
  type TimePreset,
} from '@/lib/mcp/event-tools'
import { listCategories } from '@/lib/mcp/category-tools'
import { getAnalyticsSummary } from '@/lib/mcp/analytics-tools'
import { getSettings } from '@/lib/mcp/settings-tools'
import { COLOR_HEX_VALUES } from '@/lib/mcp/colors'
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

function presetToMcp(
  preset: 'this_week' | 'this_month' | 'last_week' | 'last_month',
): { start_date: string; end_date: string } {
  const now = new Date()
  const day = 86_400_000
  const startOfDay = (d: Date) =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const today = startOfDay(now)
  // Monday-based weeks, matching the analytics engine's weekday legend.
  const weekday = (today.getUTCDay() + 6) % 7
  const thisWeekStart = new Date(today.getTime() - weekday * day)
  const thisMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  )
  switch (preset) {
    case 'this_week':
      return {
        start_date: thisWeekStart.toISOString(),
        end_date: new Date(thisWeekStart.getTime() + 7 * day).toISOString(),
      }
    case 'last_week':
      return {
        start_date: new Date(thisWeekStart.getTime() - 7 * day).toISOString(),
        end_date: thisWeekStart.toISOString(),
      }
    case 'this_month':
      return {
        start_date: thisMonthStart.toISOString(),
        end_date: new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
        ).toISOString(),
      }
    case 'last_month':
      return {
        start_date: new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
        ).toISOString(),
        end_date: thisMonthStart.toISOString(),
      }
  }
}

export function createAppToolkit(userId: string): CalendarToolkit {
  return {
    async listEvents(input) {
      const events = await listEvents(userId, {
        filter: {
          time: input.preset
            ? { preset: input.preset as TimePreset }
            : { start: input.start, end: input.end },
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
      const range = input.preset
        ? presetToMcp(input.preset)
        : { start_date: input.start, end_date: input.end }
      const summary = await getAnalyticsSummary(userId, {
        ...range,
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
  }
}
