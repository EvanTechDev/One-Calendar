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
  participants?: unknown
}

/**
 * Always a concrete instant range: named presets ("today", "next_week")
 * are resolved BEFORE the port, in src/presets.ts, so implementations
 * never re-derive calendar boundaries.
 */
export interface AgentListEventsInput {
  /** ISO date-time lower bound. */
  start?: string
  /** ISO date-time upper bound. */
  end?: string
  /** Free-text search over title/description/location. */
  query?: string
  /** Full AI candidate scan: hard constraints only, including series masters. */
  searchCandidates?: boolean
  categoryIds?: string[]
  /**
   * Participants filter. `emails` matches against the event's participant
   * list and its invitations; `exists` matches events that have (or have no)
   * participants at all. Named-only matching ("with Alex") belongs in the
   * model layer — it does not know which address Alex uses.
   */
  participants?: AgentParticipantFilter
  /** 1-based page number. The host caps a page at 50 rows. */
  page?: number
  limit?: number
  /**
   * Which end of the range to list first. Defaults to 'asc', which is what a
   * chat answer reads best as. The palette's semantic search asks for 'desc'
   * when the range can still contain events that have not happened yet.
   */
  sortDirection?: 'asc' | 'desc'
}

export interface AgentParticipantFilter {
  emails?: string[]
  /**
   * Display names, matched loosely (substring, either direction) against the
   * stored name and the address's local part. "the meeting with Alex" is how
   * people speak; an address is not.
   */
  names?: string[]
  /** `all` requires every listed address; `any` (default) requires one. */
  mode?: 'any' | 'all'
  exists?: boolean
}

/**
 * One page of results plus the paging state. The totals are part of the
 * contract: a model that cannot see them cannot tell "that was everything"
 * from "there is more", so it either stops early or silently truncates.
 */
export interface AgentEventPage {
  events: AgentEventSummary[]
  page: number
  limit: number
  total: number
  totalPages: number
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

export interface AgentBookmark {
  id: string
  eventId: string
  eventTitle?: string | null
  eventStartDate?: string | null
}

export interface AgentCountdown {
  id: string
  name: string
  targetDate: string
  description?: string | null
  color?: string | null
  icon?: string | null
}

/**
 * Port implemented by the host app. Every method may throw; the adapter
 * converts thrown errors into tool-result error strings so the model can
 * recover instead of the request failing.
 */
export interface CalendarToolkit {
  listEvents(input: AgentListEventsInput): Promise<AgentEventPage>
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
  }): Promise<AgentAnalyticsSummary>
  /** IANA timezone of the user, e.g. Asia/Shanghai. */
  getTimezone(): Promise<string>
  listBookmarks(): Promise<AgentBookmark[]>
  bookmarkEvent(input: { eventId: string }): Promise<AgentBookmark>
  removeBookmark(input: { eventId: string }): Promise<void>
  listCountdowns(): Promise<AgentCountdown[]>
  createCountdown(input: {
    name: string
    targetDate: string
    description?: string
    color?: string
  }): Promise<AgentCountdown>
  deleteCountdown(input: { countdownId: string }): Promise<void>
}
