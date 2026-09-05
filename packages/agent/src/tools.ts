/**
 * The agent's tool set, authored with eve's `defineTool` and bound to a
 * {@link CalendarToolkit} at request time.
 *
 * Why eve definitions instead of raw `ai` tools: eve's ToolDefinition is a
 * superset (description + inputSchema + execute) that both runtimes accept —
 * the standalone eve app under packages/agent/agent/ re-exports these files
 * one-per-file as eve requires, and the in-app API route lowers them to AI
 * SDK tools through `toAiTools` in adapter.ts. One authoring surface, two
 * runtimes, zero drift.
 */
import { defineTool } from 'eve/tools'
import { z } from 'zod'
import type { CalendarToolkit } from './types'
import {
  findFreeSlots,
  timezoneOffsetMs,
  type BusyInterval,
} from './scheduling'

const timePreset = z.enum([
  'today',
  'this_week',
  'next_week',
  'upcoming',
  'past',
])

const applyTo = z.enum(['all', 'single', 'following'])

const isoHint = 'ISO 8601 date-time with offset, e.g. 2026-09-05T14:00:00+08:00'

export function buildCalendarTools(toolkit: CalendarToolkit) {
  const list_events = defineTool({
    description:
      "List the user's calendar events. Filter by a time preset OR an explicit start/end range, and optionally by free-text query. Returns id, title, times, location and category of each event.",
    inputSchema: z.object({
      preset: timePreset
        .optional()
        .describe('Named time range; mutually exclusive with start/end'),
      start: z.string().optional().describe(`Range start. ${isoHint}`),
      end: z.string().optional().describe(`Range end. ${isoHint}`),
      query: z
        .string()
        .optional()
        .describe('Free-text search over title, description and location'),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    async execute(input) {
      return toolkit.listEvents(input)
    },
  })

  const create_event = defineTool({
    description:
      'Create a calendar event. Times must be ISO 8601 with offset in the user timezone. Use rrule (RFC 5545) for recurring events.',
    inputSchema: z.object({
      title: z.string().min(1).max(200),
      start: z.string().describe(`Event start. ${isoHint}`),
      end: z.string().describe(`Event end. ${isoHint}`),
      description: z.string().max(2000).optional(),
      location: z.string().max(500).optional(),
      isAllDay: z.boolean().optional(),
      categoryId: z
        .string()
        .optional()
        .describe('Category id from list_categories'),
      color: z
        .string()
        .optional()
        .describe('Hex color like #3b82f6; omit for default'),
      rrule: z
        .string()
        .optional()
        .describe('RFC 5545 recurrence rule, e.g. FREQ=WEEKLY;BYDAY=MO,WE'),
    }),
    async execute(input) {
      return toolkit.createEvent(input)
    },
  })

  const update_event = defineTool({
    description:
      'Update an existing event. Provide the event id from list_events and only the fields that change. For recurring events pass applyTo (single|following|all).',
    inputSchema: z.object({
      eventId: z.string().min(1),
      title: z.string().min(1).max(200).optional(),
      start: z.string().optional().describe(isoHint),
      end: z.string().optional().describe(isoHint),
      description: z.string().max(2000).optional(),
      location: z.string().max(500).optional(),
      isAllDay: z.boolean().optional(),
      categoryId: z.string().optional(),
      color: z.string().optional(),
      applyTo: applyTo.optional(),
    }),
    async execute(input) {
      const updated = await toolkit.updateEvent(input)
      if (!updated) return { error: 'Event not found' }
      return updated
    },
  })

  const delete_event = defineTool({
    description:
      'Delete an event by id. Destructive — only call when the user clearly asked for a deletion. For recurring events pass applyTo.',
    inputSchema: z.object({
      eventId: z.string().min(1),
      applyTo: applyTo.optional(),
    }),
    async execute(input) {
      await toolkit.deleteEvent(input)
      return { deleted: true, eventId: input.eventId }
    },
  })

  const list_categories = defineTool({
    description:
      "List the user's calendar categories (id, name, color). Use before assigning categoryId on create/update.",
    inputSchema: z.object({}),
    async execute() {
      return toolkit.listCategories()
    },
  })

  const get_schedule_summary = defineTool({
    description:
      "Summarize the user's schedule: totals, busiest periods and category breakdown for a period. Use for questions like 'how busy am I this week' or 'where does my time go'.",
    inputSchema: z.object({
      preset: z
        .enum(['this_week', 'this_month', 'last_week', 'last_month'])
        .optional(),
      start: z.string().optional().describe(isoHint),
      end: z.string().optional().describe(isoHint),
    }),
    async execute(input) {
      return toolkit.getAnalyticsSummary(input)
    },
  })

  const find_free_time = defineTool({
    description:
      'Find free slots in the user calendar between two instants, respecting existing events. Returns up to maxSlots gaps of at least durationMinutes, clamped to working hours.',
    inputSchema: z.object({
      start: z.string().describe(`Search window start. ${isoHint}`),
      end: z.string().describe(`Search window end. ${isoHint}`),
      durationMinutes: z
        .number()
        .int()
        .min(5)
        .max(24 * 60)
        .describe('Minimum length of a usable slot'),
      workdayStartHour: z
        .number()
        .int()
        .min(0)
        .max(23)
        .optional()
        .describe('Earliest local hour to suggest (default 9)'),
      workdayEndHour: z
        .number()
        .int()
        .min(1)
        .max(24)
        .optional()
        .describe('Latest local hour to suggest (default 18)'),
      maxSlots: z.number().int().min(1).max(20).optional(),
    }),
    async execute(input) {
      const windowStart = new Date(input.start)
      const windowEnd = new Date(input.end)
      if (
        Number.isNaN(windowStart.getTime()) ||
        Number.isNaN(windowEnd.getTime())
      ) {
        return { error: 'Invalid start or end date' }
      }
      const [events, timezone] = await Promise.all([
        toolkit.listEvents({
          start: windowStart.toISOString(),
          end: windowEnd.toISOString(),
          limit: 50,
        }),
        toolkit.getTimezone(),
      ])
      const busy: BusyInterval[] = events
        .filter((e) => e.status !== 'cancelled')
        .map((e) => ({
          startMs: new Date(e.startDate).getTime(),
          endMs: new Date(e.endDate).getTime(),
        }))
        .filter((b) => !Number.isNaN(b.startMs) && !Number.isNaN(b.endMs))

      // Shift into the user's wall clock so hour clamping is local, then
      // shift results back. See timezoneOffsetMs for the DST caveat.
      const offset = timezoneOffsetMs(windowStart, timezone)
      const slots = findFreeSlots({
        windowStartMs: windowStart.getTime() + offset,
        windowEndMs: windowEnd.getTime() + offset,
        busy: busy.map((b) => ({
          startMs: b.startMs + offset,
          endMs: b.endMs + offset,
        })),
        minDurationMinutes: input.durationMinutes,
        dayStartHourUtc: input.workdayStartHour ?? 9,
        dayEndHourUtc: input.workdayEndHour ?? 18,
        maxSlots: input.maxSlots ?? 10,
      })
      return {
        timezone,
        slots: slots.map((s) => ({
          start: new Date(s.startMs - offset).toISOString(),
          end: new Date(s.endMs - offset).toISOString(),
          durationMinutes: s.durationMinutes,
        })),
      }
    },
  })

  return {
    list_events,
    create_event,
    update_event,
    delete_event,
    list_categories,
    get_schedule_summary,
    find_free_time,
  }
}

export type CalendarTools = ReturnType<typeof buildCalendarTools>
