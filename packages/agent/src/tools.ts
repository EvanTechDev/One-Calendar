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
 *
 * Validation posture (mirrors the MCP server): closed vocabularies live in
 * the schema so the model sees legal values up front (colors are an enum,
 * applyTo is an enum); everything a JSON schema cannot express — real ISO
 * instants, start<end ordering, existing category ids, RRULE shape — is
 * checked in execute and returned as an error RESULT the model can read
 * and correct. Never throw for bad model input: at the Groq gateway a
 * schema violation kills the whole stream, and locally a throw would too.
 */
import { defineTool } from 'eve/tools'
import { z } from 'zod'
import type { CalendarToolkit } from './types'
import {
  findFreeSlots,
  timezoneOffsetMs,
  type BusyInterval,
} from './scheduling'
import { normalizePreset, resolvePreset, PRESET_NAMES } from './presets'
import {
  COLOR_DESCRIPTION,
  colorNameToHex,
  colorSchema,
  parseInstantRange,
  parseIsoInstant,
  validateRrule,
} from './validation'

const applyTo = z.enum(['all', 'single', 'following'])

const isoHint = 'ISO 8601 date-time with offset, e.g. 2026-09-05T14:00:00+08:00'

const presetHint = `One of: ${PRESET_NAMES.join(', ')}. Mutually exclusive with start/end.`

/**
 * Presets are validated HERE, not in the JSON schema. Groq validates tool
 * arguments server-side against the schema, and a model that invents a
 * preset used to 400 the entire stream. A plain string keeps the gateway
 * happy; an unknown value becomes an error result the model can correct.
 */
async function resolvePresetInput(
  toolkit: CalendarToolkit,
  preset: string,
): Promise<{ start?: string; end?: string } | { error: string }> {
  const normalized = normalizePreset(preset)
  if (!normalized) {
    return {
      error: `Unknown preset "${preset}". Valid presets: ${PRESET_NAMES.join(', ')}. Or pass explicit start/end instead.`,
    }
  }
  const timezone = await toolkit.getTimezone()
  return resolvePreset(normalized, new Date(), timezone)
}

/**
 * A categoryId must belong to the user. Checked against list_categories so
 * a hallucinated id becomes a correctable error naming the real options,
 * instead of an event silently filed under a category that renders as
 * "unknown" in the UI.
 */
async function checkCategoryId(
  toolkit: CalendarToolkit,
  categoryId: string,
): Promise<{ error: string } | null> {
  const categories = await toolkit.listCategories()
  if (categories.some((c) => c.id === categoryId)) return null
  const listing = categories.map((c) => `${c.id} (${c.name})`).join(', ')
  return {
    error: `Unknown categoryId "${categoryId}". The user's categories: ${listing || '(none — omit categoryId)'}`,
  }
}

export function buildCalendarTools(toolkit: CalendarToolkit) {
  const list_events = defineTool({
    description:
      "List the user's calendar events. Filter by a time preset OR an explicit start/end range, and optionally by free-text query. Returns id, title, times, location and category of each event.",
    inputSchema: z.object({
      preset: z.string().optional().describe(presetHint),
      start: z.string().optional().describe(`Range start. ${isoHint}`),
      end: z.string().optional().describe(`Range end. ${isoHint}`),
      query: z
        .string()
        .max(200)
        .optional()
        .describe('Free-text search over title, description and location'),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    async execute(input) {
      let range: { start?: string; end?: string } = {}
      if (input.preset) {
        const resolved = await resolvePresetInput(toolkit, input.preset)
        if ('error' in resolved) return resolved
        range = resolved
      } else {
        if (input.start) {
          const parsed = parseIsoInstant(input.start, 'start')
          if ('error' in parsed) return parsed
          range.start = parsed.iso
        }
        if (input.end) {
          const parsed = parseIsoInstant(input.end, 'end')
          if ('error' in parsed) return parsed
          range.end = parsed.iso
        }
      }
      return toolkit.listEvents({
        ...range,
        query: input.query,
        limit: input.limit,
      })
    },
  })

  const create_event = defineTool({
    description:
      'Create a calendar event. Times must be ISO 8601 with offset in the user timezone. Use rrule (RFC 5545) for recurring events.',
    inputSchema: z.object({
      title: z.string().min(1).max(200),
      start: z.string().describe(`Event start. ${isoHint}`),
      end: z.string().describe(`Event end, after start. ${isoHint}`),
      description: z.string().max(2000).optional(),
      location: z.string().max(500).optional(),
      isAllDay: z.boolean().optional(),
      categoryId: z
        .string()
        .max(100)
        .optional()
        .describe(
          'Category id from list_categories. Omit unless the user asked for a category.',
        ),
      color: colorSchema.optional().describe(COLOR_DESCRIPTION),
      rrule: z
        .string()
        .max(500)
        .optional()
        .describe(
          'RFC 5545 recurrence rule with FREQ=, e.g. FREQ=WEEKLY;BYDAY=MO,WE. Omit for a one-off event.',
        ),
    }),
    async execute(input) {
      const range = parseInstantRange(input.start, input.end)
      if ('error' in range) return range
      if (input.rrule) {
        const rruleError = validateRrule(input.rrule)
        if (rruleError) return { error: rruleError }
      }
      if (input.categoryId) {
        const bad = await checkCategoryId(toolkit, input.categoryId)
        if (bad) return bad
      }
      const hex = input.color ? colorNameToHex(input.color) : null
      return toolkit.createEvent({
        title: input.title,
        start: range.start.iso,
        end: range.end.iso,
        description: input.description,
        location: input.location,
        isAllDay: input.isAllDay,
        categoryId: input.categoryId,
        color: hex ?? undefined,
        rrule: input.rrule,
      })
    },
  })

  const update_event = defineTool({
    description:
      'Update an existing event. Provide the event id from list_events and only the fields that change. For recurring events pass applyTo (single|following|all).',
    inputSchema: z.object({
      eventId: z.string().min(1).max(120),
      title: z.string().min(1).max(200).optional(),
      start: z.string().optional().describe(isoHint),
      end: z.string().optional().describe(isoHint),
      description: z.string().max(2000).optional(),
      location: z.string().max(500).optional(),
      isAllDay: z.boolean().optional(),
      categoryId: z
        .string()
        .max(100)
        .optional()
        .describe('Category id from list_categories'),
      color: colorSchema.optional().describe(COLOR_DESCRIPTION),
      applyTo: applyTo.optional(),
    }),
    async execute(input) {
      let startIso: string | undefined
      let endIso: string | undefined
      if (input.start !== undefined && input.end !== undefined) {
        const range = parseInstantRange(input.start, input.end)
        if ('error' in range) return range
        startIso = range.start.iso
        endIso = range.end.iso
      } else if (input.start !== undefined) {
        const parsed = parseIsoInstant(input.start, 'start')
        if ('error' in parsed) return parsed
        startIso = parsed.iso
      } else if (input.end !== undefined) {
        const parsed = parseIsoInstant(input.end, 'end')
        if ('error' in parsed) return parsed
        endIso = parsed.iso
      }
      if (input.categoryId) {
        const bad = await checkCategoryId(toolkit, input.categoryId)
        if (bad) return bad
      }
      const hex = input.color ? colorNameToHex(input.color) : null
      const updated = await toolkit.updateEvent({
        eventId: input.eventId,
        title: input.title,
        start: startIso,
        end: endIso,
        description: input.description,
        location: input.location,
        isAllDay: input.isAllDay,
        categoryId: input.categoryId,
        color: hex ?? undefined,
        applyTo: input.applyTo,
      })
      if (!updated) return { error: 'Event not found' }
      return updated
    },
  })

  const delete_event = defineTool({
    description:
      'Delete an event by id. Destructive — only call when the user clearly asked for a deletion. For recurring events pass applyTo. The user is asked to confirm before this runs.',
    inputSchema: z.object({
      eventId: z.string().min(1).max(120),
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
      preset: z.string().optional().describe(presetHint),
      start: z.string().optional().describe(isoHint),
      end: z.string().optional().describe(isoHint),
    }),
    async execute(input) {
      // Same plain-string-plus-resolve pattern as list_events: an invented
      // preset must correct the model, not 400 the stream at the gateway.
      if (input.preset) {
        const resolved = await resolvePresetInput(toolkit, input.preset)
        if ('error' in resolved) return resolved
        return toolkit.getAnalyticsSummary(resolved)
      }
      if (input.start && input.end) {
        const range = parseInstantRange(input.start, input.end)
        if ('error' in range) return range
        return toolkit.getAnalyticsSummary({
          start: range.start.iso,
          end: range.end.iso,
        })
      }
      return toolkit.getAnalyticsSummary({ start: input.start, end: input.end })
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
      const range = parseInstantRange(input.start, input.end)
      if ('error' in range) return range
      const windowStart = range.start.date
      const windowEnd = range.end.date
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

  const list_bookmarks = defineTool({
    description:
      "List the user's bookmarked events (id, event id, event title).",
    inputSchema: z.object({}),
    async execute() {
      return toolkit.listBookmarks()
    },
  })

  const bookmark_event = defineTool({
    description:
      'Bookmark an event so it appears in the sidebar bookmark panel. Pass the event id from list_events.',
    inputSchema: z.object({
      eventId: z.string().min(1).max(120),
    }),
    async execute(input) {
      return toolkit.bookmarkEvent(input)
    },
  })

  const remove_bookmark = defineTool({
    description: 'Remove a bookmark from an event by event id.',
    inputSchema: z.object({
      eventId: z.string().min(1).max(120),
    }),
    async execute(input) {
      await toolkit.removeBookmark(input)
      return { removed: true, eventId: input.eventId }
    },
  })

  const list_countdowns = defineTool({
    description:
      "List the user's countdowns (id, name, target date) shown in the sidebar.",
    inputSchema: z.object({}),
    async execute() {
      return toolkit.listCountdowns()
    },
  })

  const create_countdown = defineTool({
    description:
      'Create a countdown to a future date, e.g. a birthday, launch or exam. Shows in the calendar sidebar.',
    inputSchema: z.object({
      name: z.string().min(1).max(100),
      targetDate: z.string().describe(`Countdown target. ${isoHint}`),
      description: z.string().max(1000).optional(),
      color: colorSchema.optional().describe(COLOR_DESCRIPTION),
    }),
    async execute(input) {
      const parsed = parseIsoInstant(input.targetDate, 'targetDate')
      if ('error' in parsed) return parsed
      const hex = input.color ? colorNameToHex(input.color) : null
      return toolkit.createCountdown({
        name: input.name,
        targetDate: parsed.iso,
        description: input.description,
        color: hex ?? undefined,
      })
    },
  })

  const delete_countdown = defineTool({
    description:
      'Delete a countdown by id (from list_countdowns). Destructive — the user is asked to confirm before this runs.',
    inputSchema: z.object({
      countdownId: z.string().min(1).max(100),
    }),
    async execute(input) {
      await toolkit.deleteCountdown(input)
      return { deleted: true, countdownId: input.countdownId }
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
    list_bookmarks,
    bookmark_event,
    remove_bookmark,
    list_countdowns,
    create_countdown,
    delete_countdown,
  }
}

export type CalendarTools = ReturnType<typeof buildCalendarTools>

/**
 * Tools that mutate or destroy data irreversibly. The in-app route marks
 * these `needsApproval` so the palette shows a confirmation before they
 * run (grilling Q2); read/create tools stay friction-free.
 */
export const DESTRUCTIVE_TOOL_NAMES = [
  'delete_event',
  'delete_countdown',
] as const
