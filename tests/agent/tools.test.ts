import { describe, expect, it } from 'vitest'
import { buildCalendarTools, DESTRUCTIVE_TOOL_NAMES } from '@zntr/agent/tools'
import { toAiTools } from '@zntr/agent/adapter'
import type {
  AgentCreateEventInput,
  AgentEventSummary,
  AgentListEventsInput,
  CalendarToolkit,
} from '@zntr/agent/types'

/** In-memory toolkit: the port's contract, no database. */
function makeFakeToolkit(overrides: Partial<CalendarToolkit> = {}): {
  toolkit: CalendarToolkit
  calls: Array<{ method: string; input: unknown }>
} {
  const calls: Array<{ method: string; input: unknown }> = []
  const events: AgentEventSummary[] = [
    {
      id: 'evt-1',
      title: 'Standup',
      startDate: '2026-09-07T09:00:00.000Z',
      endDate: '2026-09-07T09:30:00.000Z',
      isAllDay: false,
      status: 'confirmed',
    },
    {
      id: 'evt-2',
      title: 'Lunch',
      startDate: '2026-09-07T12:00:00.000Z',
      endDate: '2026-09-07T13:00:00.000Z',
      isAllDay: false,
      status: 'cancelled',
    },
  ]
  const toolkit: CalendarToolkit = {
    async listEvents(input: AgentListEventsInput) {
      calls.push({ method: 'listEvents', input })
      return events
    },
    async createEvent(input: AgentCreateEventInput) {
      calls.push({ method: 'createEvent', input })
      return {
        id: 'evt-new',
        title: input.title,
        startDate: input.start,
        endDate: input.end,
        isAllDay: input.isAllDay ?? false,
      }
    },
    async updateEvent(input) {
      calls.push({ method: 'updateEvent', input })
      if (input.eventId === 'missing') return null
      return {
        id: input.eventId,
        title: input.title ?? 'Standup',
        startDate: input.start ?? '2026-09-07T09:00:00.000Z',
        endDate: input.end ?? '2026-09-07T09:30:00.000Z',
        isAllDay: false,
      }
    },
    async deleteEvent(input) {
      calls.push({ method: 'deleteEvent', input })
    },
    async listCategories() {
      calls.push({ method: 'listCategories', input: undefined })
      return [{ id: 'cat-1', name: 'Work', color: '#3b82f6' }]
    },
    async getAnalyticsSummary(input) {
      calls.push({ method: 'getAnalyticsSummary', input })
      return {
        rangeStart: '2026-09-01T00:00:00.000Z',
        rangeEnd: '2026-09-08T00:00:00.000Z',
        totalEvents: 2,
        scheduledHours: 1.5,
        busyDays: 1,
        byCategory: [],
      }
    },
    async getTimezone() {
      calls.push({ method: 'getTimezone', input: undefined })
      return 'UTC'
    },
    async listBookmarks() {
      calls.push({ method: 'listBookmarks', input: undefined })
      return [
        {
          id: 'bm-1',
          eventId: 'evt-1',
          eventTitle: 'Standup',
          eventStartDate: '2026-09-07T09:00:00.000Z',
        },
      ]
    },
    async bookmarkEvent(input) {
      calls.push({ method: 'bookmarkEvent', input })
      return { id: 'bm-new', eventId: input.eventId }
    },
    async removeBookmark(input) {
      calls.push({ method: 'removeBookmark', input })
    },
    async listCountdowns() {
      calls.push({ method: 'listCountdowns', input: undefined })
      return [
        {
          id: 'cd-1',
          name: 'Launch',
          targetDate: '2026-12-31T00:00:00.000Z',
        },
      ]
    },
    async createCountdown(input) {
      calls.push({ method: 'createCountdown', input })
      return {
        id: 'cd-new',
        name: input.name,
        targetDate: input.targetDate,
        description: input.description ?? null,
        color: input.color ?? null,
      }
    },
    async deleteCountdown(input) {
      calls.push({ method: 'deleteCountdown', input })
    },
    ...overrides,
  }
  return { toolkit, calls }
}

type Executable = {
  execute: (input: unknown, options: unknown) => Promise<unknown>
}

function exec(tool: unknown, input: unknown): Promise<unknown> {
  return (tool as Executable).execute(input, {
    toolCallId: 'call-1',
    messages: [],
  })
}

describe('buildCalendarTools', () => {
  it('exposes the full tool set', () => {
    const { toolkit } = makeFakeToolkit()
    const tools = buildCalendarTools(toolkit)
    expect(Object.keys(tools).sort()).toEqual([
      'bookmark_event',
      'create_countdown',
      'create_event',
      'delete_countdown',
      'delete_event',
      'find_free_time',
      'get_schedule_summary',
      'list_bookmarks',
      'list_categories',
      'list_countdowns',
      'list_events',
      'remove_bookmark',
      'update_event',
    ])
  })

  it('create_event rejects a non-ISO start as an error result', async () => {
    const { toolkit, calls } = makeFakeToolkit()
    const tools = buildCalendarTools(toolkit)
    const result = (await exec(tools.create_event, {
      title: 'Meeting',
      start: 'tomorrow 3pm',
      end: '2026-09-08T16:00:00+08:00',
    })) as { error?: string }
    expect(result.error).toContain('ISO 8601')
    expect(calls.find((c) => c.method === 'createEvent')).toBeUndefined()
  })

  it('create_event rejects end before start', async () => {
    const { toolkit, calls } = makeFakeToolkit()
    const tools = buildCalendarTools(toolkit)
    const result = (await exec(tools.create_event, {
      title: 'Meeting',
      start: '2026-09-08T16:00:00+08:00',
      end: '2026-09-08T15:00:00+08:00',
    })) as { error?: string }
    expect(result.error).toContain('must be after')
    expect(calls.find((c) => c.method === 'createEvent')).toBeUndefined()
  })

  it('create_event rejects a prose rrule', async () => {
    const { toolkit, calls } = makeFakeToolkit()
    const tools = buildCalendarTools(toolkit)
    const result = (await exec(tools.create_event, {
      title: 'Standup',
      start: '2026-09-08T09:00:00Z',
      end: '2026-09-08T09:30:00Z',
      rrule: 'every monday',
    })) as { error?: string }
    expect(result.error).toContain('FREQ=')
    expect(calls.find((c) => c.method === 'createEvent')).toBeUndefined()
  })

  it('create_event rejects a hallucinated categoryId, naming the real ones', async () => {
    const { toolkit, calls } = makeFakeToolkit()
    const tools = buildCalendarTools(toolkit)
    const result = (await exec(tools.create_event, {
      title: 'Meeting',
      start: '2026-09-08T15:00:00Z',
      end: '2026-09-08T16:00:00Z',
      categoryId: 'made-up',
    })) as { error?: string }
    expect(result.error).toContain('Unknown categoryId "made-up"')
    expect(result.error).toContain('cat-1')
    expect(calls.find((c) => c.method === 'createEvent')).toBeUndefined()
  })

  it('create_event maps a palette color name to its stored hex', async () => {
    const { toolkit, calls } = makeFakeToolkit()
    const tools = buildCalendarTools(toolkit)
    await exec(tools.create_event, {
      title: 'Meeting',
      start: '2026-09-08T15:00:00Z',
      end: '2026-09-08T16:00:00Z',
      color: 'green',
    })
    const created = calls.find((c) => c.method === 'createEvent')!
    expect((created.input as { color?: string }).color).toBe('#10B981')
  })

  it('create_event normalizes instants to UTC ISO before the toolkit', async () => {
    const { toolkit, calls } = makeFakeToolkit()
    const tools = buildCalendarTools(toolkit)
    await exec(tools.create_event, {
      title: 'Meeting',
      start: '2026-09-08T15:00:00+08:00',
      end: '2026-09-08T16:00:00+08:00',
    })
    const created = calls.find((c) => c.method === 'createEvent')!
    const input = created.input as { start: string; end: string }
    expect(input.start).toBe('2026-09-08T07:00:00.000Z')
    expect(input.end).toBe('2026-09-08T08:00:00.000Z')
  })

  it('countdown tools round-trip through the toolkit', async () => {
    const { toolkit, calls } = makeFakeToolkit()
    const tools = buildCalendarTools(toolkit)
    const created = (await exec(tools.create_countdown, {
      name: 'Launch',
      targetDate: '2026-12-31T00:00:00Z',
      color: 'red',
    })) as { id: string }
    expect(created.id).toBe('cd-new')
    expect(
      (
        calls.find((c) => c.method === 'createCountdown')!.input as {
          color?: string
        }
      ).color,
    ).toBe('#EF4444')

    const deleted = await exec(tools.delete_countdown, {
      countdownId: 'cd-1',
    })
    expect(deleted).toEqual({ deleted: true, countdownId: 'cd-1' })
  })

  it('bookmark tools round-trip through the toolkit', async () => {
    const { toolkit } = makeFakeToolkit()
    const tools = buildCalendarTools(toolkit)
    const bookmarks = (await exec(tools.list_bookmarks, {})) as unknown[]
    expect(bookmarks).toHaveLength(1)
    const removed = await exec(tools.remove_bookmark, { eventId: 'evt-1' })
    expect(removed).toEqual({ removed: true, eventId: 'evt-1' })
  })

  it('list_events resolves presets to concrete instants before the toolkit', async () => {
    const { toolkit, calls } = makeFakeToolkit()
    const tools = buildCalendarTools(toolkit)
    await exec(tools.list_events, { preset: 'today', query: 'stand' })
    // getTimezone is consulted to resolve the preset, then listEvents gets
    // a concrete range — never the preset name.
    const listCall = calls.find((c) => c.method === 'listEvents')!
    const input = listCall.input as {
      start?: string
      end?: string
      query?: string
    }
    expect(input.query).toBe('stand')
    expect(input.start).toMatch(/T00:00:00\.000Z$/)
    expect(input.end).toMatch(/T00:00:00\.000Z$/)
    expect((input as Record<string, unknown>).preset).toBeUndefined()
  })

  it('list_events turns an unknown preset into an error result, not a schema failure', async () => {
    const { toolkit, calls } = makeFakeToolkit()
    const tools = buildCalendarTools(toolkit)
    const result = (await exec(tools.list_events, {
      preset: 'sometime_soon',
    })) as { error?: string }
    expect(result.error).toContain('Unknown preset "sometime_soon"')
    expect(result.error).toContain('today')
    expect(calls.find((c) => c.method === 'listEvents')).toBeUndefined()
  })

  it('list_events accepts preset aliases like "week"', async () => {
    const { toolkit, calls } = makeFakeToolkit()
    const tools = buildCalendarTools(toolkit)
    await exec(tools.list_events, { preset: 'week' })
    expect(calls.find((c) => c.method === 'listEvents')).toBeDefined()
  })

  it('update_event surfaces a not-found as an error value, not a throw', async () => {
    const { toolkit } = makeFakeToolkit()
    const tools = buildCalendarTools(toolkit)
    const result = await exec(tools.update_event, { eventId: 'missing' })
    expect(result).toEqual({ error: 'Event not found' })
  })

  it('delete_event reports what it deleted', async () => {
    const { toolkit, calls } = makeFakeToolkit()
    const tools = buildCalendarTools(toolkit)
    const result = await exec(tools.delete_event, { eventId: 'evt-1' })
    expect(result).toEqual({ deleted: true, eventId: 'evt-1' })
    expect(calls[0].method).toBe('deleteEvent')
  })

  it('find_free_time excludes cancelled events from busy time', async () => {
    const { toolkit } = makeFakeToolkit()
    const tools = buildCalendarTools(toolkit)
    const result = (await exec(tools.find_free_time, {
      start: '2026-09-07T08:00:00.000Z',
      end: '2026-09-07T14:00:00.000Z',
      durationMinutes: 60,
      workdayStartHour: 8,
      workdayEndHour: 14,
    })) as { timezone: string; slots: Array<{ start: string; end: string }> }

    expect(result.timezone).toBe('UTC')
    // Busy: Standup 09:00–09:30 (confirmed). Lunch is cancelled → free, so
    // the 12:00–13:00 hour is NOT carved out of the second slot.
    expect(result.slots).toEqual([
      expect.objectContaining({
        start: '2026-09-07T08:00:00.000Z',
        end: '2026-09-07T09:00:00.000Z',
      }),
      expect.objectContaining({
        start: '2026-09-07T09:30:00.000Z',
        end: '2026-09-07T14:00:00.000Z',
      }),
    ])
  })

  it('find_free_time rejects invalid dates gracefully', async () => {
    const { toolkit } = makeFakeToolkit()
    const tools = buildCalendarTools(toolkit)
    const result = await exec(tools.find_free_time, {
      start: 'not-a-date',
      end: '2026-09-07T14:00:00.000Z',
      durationMinutes: 60,
    })
    expect((result as { error: string }).error).toContain('ISO 8601')
  })
})

describe('toAiTools', () => {
  it('converts a thrown toolkit error into an error result', async () => {
    const { toolkit } = makeFakeToolkit({
      listEvents: async () => {
        throw new Error('database on fire')
      },
    })
    const tools = toAiTools(
      buildCalendarTools(toolkit) as unknown as Parameters<typeof toAiTools>[0],
    )
    const result = await exec(tools.list_events, {})
    expect(result).toEqual({ error: 'database on fire' })
  })

  it('passes successful results through unchanged', async () => {
    const { toolkit } = makeFakeToolkit()
    const tools = toAiTools(
      buildCalendarTools(toolkit) as unknown as Parameters<typeof toAiTools>[0],
    )
    const result = (await exec(tools.list_categories, {})) as unknown[]
    expect(result).toEqual([{ id: 'cat-1', name: 'Work', color: '#3b82f6' }])
  })

  it('preserves tool descriptions and schemas', () => {
    const { toolkit } = makeFakeToolkit()
    const eveTools = buildCalendarTools(toolkit)
    const aiTools = toAiTools(
      eveTools as unknown as Parameters<typeof toAiTools>[0],
    )
    expect(aiTools.create_event.description).toBe(
      eveTools.create_event.description,
    )
    expect(aiTools.create_event.inputSchema).toBe(
      eveTools.create_event.inputSchema,
    )
  })

  it('marks only the requested tools as needing approval', () => {
    const { toolkit } = makeFakeToolkit()
    const aiTools = toAiTools(
      buildCalendarTools(toolkit) as unknown as Parameters<typeof toAiTools>[0],
      { needsApproval: DESTRUCTIVE_TOOL_NAMES },
    )
    expect(
      (aiTools.delete_event as { needsApproval?: boolean }).needsApproval,
    ).toBe(true)
    expect(
      (aiTools.delete_countdown as { needsApproval?: boolean }).needsApproval,
    ).toBe(true)
    expect(
      (aiTools.list_events as { needsApproval?: boolean }).needsApproval,
    ).toBeUndefined()
    expect(
      (aiTools.create_event as { needsApproval?: boolean }).needsApproval,
    ).toBeUndefined()
  })
})
