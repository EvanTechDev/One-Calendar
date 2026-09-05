import { describe, expect, it } from 'vitest'
import { buildCalendarTools } from '@zntr/agent/tools'
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
      'create_event',
      'delete_event',
      'find_free_time',
      'get_schedule_summary',
      'list_categories',
      'list_events',
      'update_event',
    ])
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
    expect(result).toEqual({ error: 'Invalid start or end date' })
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
})
