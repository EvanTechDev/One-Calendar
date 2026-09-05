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
 * SCHEMA POSTURE — read before "fixing" these schemas:
 * Groq's gateway validates every tool call against the JSON schema and a
 * violation 400s the ENTIRE stream. In production the model repeatedly
 * killed conversations by omitting a required field ("missing properties:
 * 'end'"), inventing an enum value ("/preset must be one of …"), or going
 * out of numeric range. The schemas below are therefore deliberately
 * permissive: every property optional, no enums, no min/max, and
 * z.looseObject so extra properties are ignored (z.object emits
 * additionalProperties:false — one hallucinated extra field would 400) —
 * constraints live in the DESCRIPTIONS for the model to read, and are
 * enforced in execute via the guards in validation.ts, which return error
 * RESULTS the model can read and correct on its next step. Tightening
 * these schemas reintroduces the dead-stream bug.
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
  APPLY_TO_VALUES,
  COLOR_DESCRIPTION,
  clampInt,
  parseInstantRange,
  parseIsoInstant,
  requireFields,
  validateApplyTo,
  validateColor,
  validateMaxLength,
  validateRrule,
} from './validation'

const isoHint = 'ISO 8601 date-time with offset, e.g. 2026-09-05T14:00:00+08:00'

const presetHint = `One of: ${PRESET_NAMES.join(', ')}. Mutually exclusive with start/end.`

const applyToHint = `For recurring events: one of ${APPLY_TO_VALUES.join(', ')}. Omit for non-recurring events.`

/**
 * Presets are validated in execute, not in the JSON schema — see the
 * schema-posture note above.
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
    inputSchema: z.looseObject({
      preset: z.string().optional().describe(presetHint),
      start: z.string().optional().describe(`Range start. ${isoHint}`),
      end: z.string().optional().describe(`Range end. ${isoHint}`),
      query: z
        .string()
        .optional()
        .describe(
          'Free-text search over title, description and location. Max 200 chars.',
        ),
      limit: z.number().optional().describe('Max results, 1-50 (default 20)'),
    }),
    async execute(input) {
      const tooLong = validateMaxLength(input, { query: 200 })
      if (tooLong) return tooLong
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
        limit: clampInt(input.limit, 1, 50),
      })
    },
  })

  const create_event = defineTool({
    description:
      'Create a calendar event. REQUIRED: title, start, end. Times must be ISO 8601 with offset in the user timezone. Use rrule (RFC 5545) for recurring events.',
    inputSchema: z.looseObject({
      title: z
        .string()
        .optional()
        .describe('Event title. Required. Max 200 chars.'),
      start: z
        .string()
        .optional()
        .describe(`Event start. Required. ${isoHint}`),
      end: z
        .string()
        .optional()
        .describe(`Event end, after start. Required. ${isoHint}`),
      description: z.string().optional().describe('Max 2000 chars'),
      location: z.string().optional().describe('Max 500 chars'),
      isAllDay: z.boolean().optional(),
      categoryId: z
        .string()
        .optional()
        .describe(
          'Category id from list_categories. Omit unless the user asked for a category.',
        ),
      color: z.string().optional().describe(COLOR_DESCRIPTION),
      rrule: z
        .string()
        .optional()
        .describe(
          'RFC 5545 recurrence rule with FREQ=, e.g. FREQ=WEEKLY;BYDAY=MO,WE. Omit for a one-off event.',
        ),
    }),
    async execute(input) {
      const missing = requireFields(input, ['title', 'start', 'end'])
      if (missing) return missing
      const tooLong = validateMaxLength(input, {
        title: 200,
        description: 2000,
        location: 500,
        rrule: 500,
      })
      if (tooLong) return tooLong
      const range = parseInstantRange(input.start!, input.end!)
      if ('error' in range) return range
      if (input.rrule) {
        const rruleError = validateRrule(input.rrule)
        if (rruleError) return { error: rruleError }
      }
      if (input.categoryId) {
        const bad = await checkCategoryId(toolkit, input.categoryId)
        if (bad) return bad
      }
      const color = validateColor(input.color)
      if ('error' in color) return color
      return toolkit.createEvent({
        title: input.title!,
        start: range.start.iso,
        end: range.end.iso,
        description: input.description,
        location: input.location,
        isAllDay: input.isAllDay,
        categoryId: input.categoryId,
        color: color.hex,
        rrule: input.rrule,
      })
    },
  })

  const update_event = defineTool({
    description:
      'Update an existing event. REQUIRED: eventId (from list_events). Pass only the fields that change. For recurring events pass applyTo.',
    inputSchema: z.looseObject({
      eventId: z
        .string()
        .optional()
        .describe('Event id from list_events. Required.'),
      title: z.string().optional().describe('Max 200 chars'),
      start: z.string().optional().describe(isoHint),
      end: z.string().optional().describe(isoHint),
      description: z.string().optional().describe('Max 2000 chars'),
      location: z.string().optional().describe('Max 500 chars'),
      isAllDay: z.boolean().optional(),
      categoryId: z
        .string()
        .optional()
        .describe('Category id from list_categories'),
      color: z.string().optional().describe(COLOR_DESCRIPTION),
      applyTo: z.string().optional().describe(applyToHint),
    }),
    async execute(input) {
      const missing = requireFields(input, ['eventId'])
      if (missing) return missing
      const tooLong = validateMaxLength(input, {
        title: 200,
        description: 2000,
        location: 500,
      })
      if (tooLong) return tooLong
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
      const color = validateColor(input.color)
      if ('error' in color) return color
      const applyTo = validateApplyTo(input.applyTo)
      if ('error' in applyTo) return applyTo
      const updated = await toolkit.updateEvent({
        eventId: input.eventId!,
        title: input.title,
        start: startIso,
        end: endIso,
        description: input.description,
        location: input.location,
        isAllDay: input.isAllDay,
        categoryId: input.categoryId,
        color: color.hex,
        applyTo: applyTo.applyTo,
      })
      if (!updated) return { error: 'Event not found' }
      return updated
    },
  })

  const delete_event = defineTool({
    description:
      'Delete an event. REQUIRED: eventId. Destructive — only call when the user clearly asked for a deletion. For recurring events pass applyTo. The user is asked to confirm before this runs.',
    inputSchema: z.looseObject({
      eventId: z
        .string()
        .optional()
        .describe('Event id from list_events. Required.'),
      applyTo: z.string().optional().describe(applyToHint),
    }),
    async execute(input) {
      const missing = requireFields(input, ['eventId'])
      if (missing) return missing
      const applyTo = validateApplyTo(input.applyTo)
      if ('error' in applyTo) return applyTo
      await toolkit.deleteEvent({
        eventId: input.eventId!,
        applyTo: applyTo.applyTo,
      })
      return { deleted: true, eventId: input.eventId }
    },
  })

  const list_categories = defineTool({
    description:
      "List the user's calendar categories (id, name, color). Use before assigning categoryId on create/update.",
    inputSchema: z.looseObject({}),
    async execute() {
      return toolkit.listCategories()
    },
  })

  const get_schedule_summary = defineTool({
    description:
      "Summarize the user's schedule: totals, busiest periods and category breakdown for a period. Use for questions like 'how busy am I this week' or 'where does my time go'.",
    inputSchema: z.looseObject({
      preset: z.string().optional().describe(presetHint),
      start: z.string().optional().describe(isoHint),
      end: z.string().optional().describe(isoHint),
    }),
    async execute(input) {
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
      'Find free slots in the user calendar between two instants, respecting existing events. REQUIRED: start, end, durationMinutes. Returns gaps clamped to working hours.',
    inputSchema: z.looseObject({
      start: z
        .string()
        .optional()
        .describe(`Search window start. Required. ${isoHint}`),
      end: z
        .string()
        .optional()
        .describe(`Search window end. Required. ${isoHint}`),
      durationMinutes: z
        .number()
        .optional()
        .describe('Minimum usable slot length in minutes. Required. 5-1440.'),
      workdayStartHour: z
        .number()
        .optional()
        .describe('Earliest local hour to suggest, 0-23 (default 9)'),
      workdayEndHour: z
        .number()
        .optional()
        .describe('Latest local hour to suggest, 1-24 (default 18)'),
      maxSlots: z.number().optional().describe('Max slots, 1-20 (default 10)'),
    }),
    async execute(input) {
      const missing = requireFields(input, ['start', 'end'])
      if (missing) return missing
      if (typeof input.durationMinutes !== 'number') {
        return {
          error:
            'Missing required field: durationMinutes (minimum slot length in minutes, 5-1440).',
        }
      }
      const range = parseInstantRange(input.start!, input.end!)
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
        minDurationMinutes: clampInt(input.durationMinutes, 5, 1440) ?? 30,
        dayStartHourUtc: clampInt(input.workdayStartHour, 0, 23) ?? 9,
        dayEndHourUtc: clampInt(input.workdayEndHour, 1, 24) ?? 18,
        maxSlots: clampInt(input.maxSlots, 1, 20) ?? 10,
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
    inputSchema: z.looseObject({}),
    async execute() {
      return toolkit.listBookmarks()
    },
  })

  const bookmark_event = defineTool({
    description:
      'Bookmark an event so it appears in the sidebar bookmark panel. REQUIRED: eventId (from list_events).',
    inputSchema: z.looseObject({
      eventId: z
        .string()
        .optional()
        .describe('Event id from list_events. Required.'),
    }),
    async execute(input) {
      const missing = requireFields(input, ['eventId'])
      if (missing) return missing
      return toolkit.bookmarkEvent({ eventId: input.eventId! })
    },
  })

  const remove_bookmark = defineTool({
    description: 'Remove a bookmark from an event. REQUIRED: eventId.',
    inputSchema: z.looseObject({
      eventId: z
        .string()
        .optional()
        .describe('Event id whose bookmark to remove. Required.'),
    }),
    async execute(input) {
      const missing = requireFields(input, ['eventId'])
      if (missing) return missing
      await toolkit.removeBookmark({ eventId: input.eventId! })
      return { removed: true, eventId: input.eventId }
    },
  })

  const list_countdowns = defineTool({
    description:
      "List the user's countdowns (id, name, target date) shown in the sidebar.",
    inputSchema: z.looseObject({}),
    async execute() {
      return toolkit.listCountdowns()
    },
  })

  const create_countdown = defineTool({
    description:
      'Create a countdown to a future date, e.g. a birthday, launch or exam. REQUIRED: name, targetDate. Shows in the calendar sidebar.',
    inputSchema: z.looseObject({
      name: z
        .string()
        .optional()
        .describe('Countdown name. Required. Max 100 chars.'),
      targetDate: z
        .string()
        .optional()
        .describe(`Countdown target. Required. ${isoHint}`),
      description: z.string().optional().describe('Max 1000 chars'),
      color: z.string().optional().describe(COLOR_DESCRIPTION),
    }),
    async execute(input) {
      const missing = requireFields(input, ['name', 'targetDate'])
      if (missing) return missing
      const tooLong = validateMaxLength(input, {
        name: 100,
        description: 1000,
      })
      if (tooLong) return tooLong
      const parsed = parseIsoInstant(input.targetDate!, 'targetDate')
      if ('error' in parsed) return parsed
      const color = validateColor(input.color)
      if ('error' in color) return color
      return toolkit.createCountdown({
        name: input.name!,
        targetDate: parsed.iso,
        description: input.description,
        color: color.hex,
      })
    },
  })

  const delete_countdown = defineTool({
    description:
      'Delete a countdown. REQUIRED: countdownId (from list_countdowns). Destructive — the user is asked to confirm before this runs.',
    inputSchema: z.looseObject({
      countdownId: z
        .string()
        .optional()
        .describe('Countdown id from list_countdowns. Required.'),
    }),
    async execute(input) {
      const missing = requireFields(input, ['countdownId'])
      if (missing) return missing
      await toolkit.deleteCountdown({ countdownId: input.countdownId! })
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
