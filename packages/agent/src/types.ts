/**
 * The calendar capabilities an agent runs against, expressed as a plain
 * interface so this package never imports the app's database, crypto or
 * cache layers. The calendar app implements this with its existing
 * userId-scoped MCP tool functions; tests implement it in memory.
 *
 * Everything is already scoped to one user: a toolkit instance is created
 * per authenticated request, so no method takes a userId. That is the same
 * security posture as the MCP server (auth happens at the boundary, tools
 * trust their scope).
 */

export type AgentTimePreset =
  | 'today'
  | 'this_week'
  | 'next_week'
  | 'upcoming'
  | 'past'

export interface AgentEventSummary {
  id: string
  title: string
  description?: string | null
  location?: string | null
  startDate: string
  endDate: string
  isAllDay: boolean
  status?: string | null
  color?: string | null
  categoryId?: string | null
  recurrenceSummary?: string | null
}

export interface AgentListEventsInput {
  /** ISO date-time lower bound; mutually exclusive with preset. */
  start?: string
  /** ISO date-time upper bound; mutually exclusive with preset. */
  end?: string
  preset?: AgentTimePreset
  /** Free-text search over title/description/location. */
  query?: string
  categoryIds?: string[]
  limit?: number
}

export interface AgentCreateEventInput {
  title: string
  start: string
  end: string
  description?: string
  location?: string
  isAllDay?: boolean
  categoryId?: string
  color?: string
  /** RFC 5545 RRULE for recurring events, e.g. FREQ=WEEKLY;BYDAY=MO */
  rrule?: string
}

export interface AgentUpdateEventInput {
  eventId: string
  title?: string
  start?: string
  end?: string
  description?: string
  location?: string
  isAllDay?: boolean
  categoryId?: string
  color?: string
  rrule?: string | null
  /** For recurring events: which occurrences the edit applies to. */
  applyTo?: 'all' | 'single' | 'following'
}

export interface AgentCategory {
  id: string
  name: string
  color: string
}

export interface AgentAnalyticsSummary {
  rangeStart: string
  rangeEnd: string
  totalEvents: number
  scheduledHours: number
  busyDays: number
  byCategory: Array<{
    categoryId: string
    categoryName?: string | null
    count: number
    hours: number
  }>
  comparison?: unknown
}

export interface AgentFreeSlot {
  start: string
  end: string
  durationMinutes: number
}

/**
 * Port implemented by the host app. Every method may throw; the adapter
 * converts thrown errors into tool-result error strings so the model can
 * recover instead of the request failing.
 */
export interface CalendarToolkit {
  listEvents(input: AgentListEventsInput): Promise<AgentEventSummary[]>
  createEvent(input: AgentCreateEventInput): Promise<AgentEventSummary>
  updateEvent(input: AgentUpdateEventInput): Promise<AgentEventSummary | null>
  deleteEvent(input: {
    eventId: string
    applyTo?: 'all' | 'single' | 'following'
  }): Promise<void>
  listCategories(): Promise<AgentCategory[]>
  getAnalyticsSummary(input: {
    start?: string
    end?: string
    preset?: 'this_week' | 'this_month' | 'last_week' | 'last_month'
  }): Promise<AgentAnalyticsSummary>
  /** IANA timezone of the user, e.g. Asia/Shanghai. */
  getTimezone(): Promise<string>
}
