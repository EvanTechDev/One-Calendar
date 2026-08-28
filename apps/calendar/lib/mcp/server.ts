import {
  McpServer,
  SUPPORTED_PROTOCOL_VERSIONS,
  type AuthInfo,
} from '@modelcontextprotocol/server'
import { z } from 'zod'
import {
  COLOR_HEX_LIST,
  COLOR_HEX_VALUES,
  COLOR_NAME_LIST,
  COLOR_NAMES,
} from './colors'
import { CATEGORY_COLOR_VALUES } from './category-tools'
import {
  COUNTDOWN_ICON_ENUM,
  COUNTDOWN_ICON_GROUPS,
  COUNTDOWN_ICON_NAMES,
} from '@/lib/countdown-icons'
import { InvalidEventQueryError, ParticipantError } from './errors'
import { withToolAudit } from './tool-audit'

const SCOPE_EVENTS_READ = 'events:read'
const SCOPE_EVENTS_WRITE = 'events:write'
const SCOPE_CATEGORIES_READ = 'categories:read'
const SCOPE_CATEGORIES_WRITE = 'categories:write'
const SCOPE_COUNTDOWNS_READ = 'countdowns:read'
const SCOPE_COUNTDOWNS_WRITE = 'countdowns:write'
const SCOPE_SETTINGS_READ = 'settings:read'
const SCOPE_SETTINGS_WRITE = 'settings:write'
const SCOPE_PROFILE_READ = 'profile:read'
const SCOPE_BOOKMARKS_READ = 'bookmarks:read'
const SCOPE_BOOKMARKS_WRITE = 'bookmarks:write'

const EVENT_STATUS_OPTIONS = ['confirmed', 'tentative', 'cancelled'] as const
const TIME_PRESET_OPTIONS = [
  'today',
  'this_week',
  'next_week',
  'upcoming',
  'past',
] as const
const EVENT_SORT_FIELDS = [
  'start_date',
  'end_date',
  'created_at',
  'updated_at',
] as const
const EVENT_SEARCH_FIELDS = ['title', 'description', 'location'] as const

const COLOR_DESCRIPTION = `Color by name (${COLOR_NAME_LIST}) or hex code (${COLOR_HEX_LIST})`

const COLOR_SCHEMA = z.union([z.enum(COLOR_NAMES), z.enum(COLOR_HEX_VALUES)])

/**
 * Countdown icons are restricted to the shared catalogue. An arbitrary string
 * used to be accepted and then silently rendered as the fallback Clock, so an
 * agent had no way to tell that its icon was rejected.
 */
const COUNTDOWN_ICON_DESCRIPTION = `Icon name from the countdown catalogue (${COUNTDOWN_ICON_NAMES.length} options, e.g. ${COUNTDOWN_ICON_NAMES.slice(0, 8).join(', ')}). Use list_countdown_icons to see them all.`

const COUNTDOWN_ICON_SCHEMA = z.enum(COUNTDOWN_ICON_ENUM)

const LANGUAGE_OPTIONS = [
  'bn',
  'de',
  'el',
  'en',
  'en-GB',
  'es',
  'fi',
  'fr',
  'hi',
  'is',
  'it',
  'ja',
  'ko',
  'lt',
  'lv',
  'mk',
  'nb',
  'nl',
  'pl',
  'pt',
  'ro',
  'ru',
  'sl',
  'sq',
  'sr',
  'sv',
  'sw',
  'th',
  'tr',
  'uk',
  'vi',
  'yue',
  'zh-CN',
  'zh-HK',
  'zh-TW',
] as const

const DEFAULT_VIEW_OPTIONS = [
  'day',
  'week',
  'four-day',
  'month',
  'year',
] as const
const TIME_FORMAT_OPTIONS = ['24h', '12h'] as const
const THEME_OPTIONS = ['light', 'dark', 'system'] as const

function getUserId(authInfo?: AuthInfo): string {
  const id = authInfo?.extra?.userId as string | undefined
  if (!id) throw new Error('Unauthorized')
  return id
}

function getUserEmail(authInfo?: AuthInfo): string {
  const email = authInfo?.extra?.email as string | undefined
  if (!email) throw new Error('Missing user email')
  return email
}

function requireScope(authInfo: AuthInfo | undefined, scope: string): void {
  if (!authInfo?.scopes?.includes(scope)) {
    throw new Error(`Missing required scope: ${scope}`)
  }
}

function respond(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] }
}

function respondError(err: unknown) {
  console.error('MCP tool error:', err)
  return {
    content: [{ type: 'text' as const, text: 'Internal server error' }],
    isError: true as const,
  }
}

function respondCliError(err: unknown): {
  content: { type: 'text'; text: string }[]
  isError: true
} {
  const message =
    err instanceof InvalidEventQueryError || err instanceof ParticipantError
      ? err.message
      : 'Invalid request'
  return {
    content: [
      { type: 'text' as const, text: JSON.stringify({ error: message }) },
    ],
    isError: true as const,
  }
}

function respondMessage(msg: string) {
  return { content: [{ type: 'text' as const, text: msg }] }
}

type LegacyToolServer = McpServer & {
  tool<S extends z.ZodRawShape>(
    name: string,
    description: string,
    shape: S,
    handler: (
      params: z.infer<z.ZodObject<S>>,
      extra: { authInfo?: AuthInfo },
    ) => Promise<unknown>,
  ): unknown
}

/**
 * Wraps `server.tool` so every registration gets audit logging without
 * touching the 27 call sites (CORE-128). Intercepting here also guarantees a
 * tool added later is audited by default rather than silently escaping the
 * log.
 */
function withAuditedTools(server: McpServer): LegacyToolServer {
  const legacy = server as LegacyToolServer
  legacy.tool = ((
    name: string,
    description: string,
    shape: z.ZodRawShape,
    handler: (
      params: Record<string, unknown>,
      extra: { authInfo?: AuthInfo },
    ) => Promise<unknown>,
  ) => {
    const audited = withToolAudit(name, handler)
    return server.registerTool(
      name,
      { description, inputSchema: shape } as never,
      ((params: Record<string, unknown>, context: unknown) => {
        const http = (context as { http?: { authInfo?: AuthInfo } }).http
        return audited(params, { authInfo: http?.authInfo })
      }) as never,
    )
  }) as LegacyToolServer['tool']
  return legacy
}

export function createServer(): McpServer {
  const server = withAuditedTools(
    new McpServer(
      { name: 'Zentra Calendar MCP', version: '2.0.0' },
      {
        capabilities: { tools: {} },
        supportedProtocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS],
        enforceStrictCapabilities: true,
      },
    ),
  )

  registerEventTools(server)
  registerEventParticipantTools(server)
  registerAnalyticsTools(server)
  registerCategoryTools(server)
  registerCountdownTools(server)
  registerSettingsTools(server)
  registerProfileTool(server)
  registerBookmarkTools(server)

  return server
}

const ANALYTICS_RANGE_SHAPE = {
  days: z
    .number()
    .optional()
    .describe(
      'Relative window: the last N days including today (1-366, default 30). Mutually exclusive with start_date/end_date.',
    ),
  start_date: z
    .string()
    .optional()
    .describe('Absolute range start (ISO 8601); requires end_date'),
  end_date: z
    .string()
    .optional()
    .describe('Absolute range end (ISO 8601); requires start_date'),
  timezone: z
    .string()
    .optional()
    .describe(
      'IANA timezone for day/hour bucketing (defaults to the user settings timezone)',
    ),
}

function registerAnalyticsTools(server: LegacyToolServer): void {
  server.tool(
    'get_analytics_summary',
    `Get aggregated schedule statistics for a date range: total events,
scheduled hours, busy days, average event length, per-category breakdown,
and (by default) a comparison against the immediately preceding period of
the same length. Recurring series are counted per occurrence. Use this
instead of listing events when the user asks "how busy was I", "how much
time did I spend on X", or wants trends.`,
    {
      ...ANALYTICS_RANGE_SHAPE,
      compare_previous_period: z
        .boolean()
        .optional()
        .describe(
          'Include deltas vs the preceding period of equal length (default true)',
        ),
      include_category_names: z
        .boolean()
        .optional()
        .describe(
          'Resolve category ids to names (requires the categories:read scope)',
        ),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_EVENTS_READ)
      if (params.include_category_names) {
        requireScope(extra.authInfo, SCOPE_CATEGORIES_READ)
      }
      const userId = getUserId(extra.authInfo)
      try {
        const { getAnalyticsSummary } = await import('./analytics-tools')
        return respond(await getAnalyticsSummary(userId, params))
      } catch (err) {
        if (err instanceof InvalidEventQueryError) return respondCliError(err)
        return respondError(err)
      }
    },
  )

  server.tool(
    'get_time_distribution',
    `Get how events distribute across weekdays and hours of the day for a
date range: per-weekday counts and scheduled hours (weekday 0 = Monday),
a 24-bucket start-hour histogram, a 7x24 punch-card matrix, and the densest
2-hour start window. All-day events count toward weekdays but not hours.`,
    ANALYTICS_RANGE_SHAPE,
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_EVENTS_READ)
      const userId = getUserId(extra.authInfo)
      try {
        const { getTimeDistribution } = await import('./analytics-tools')
        return respond(await getTimeDistribution(userId, params))
      } catch (err) {
        if (err instanceof InvalidEventQueryError) return respondCliError(err)
        return respondError(err)
      }
    },
  )

  server.tool(
    'get_analytics_insights',
    `Get rule-based schedule insights for a date range, each with a type,
severity (warning | info | positive) and structured data: volume trends vs
the previous period, overloaded days, busy-day streaks, missing rest days,
schedule fragmentation, category share shifts, peak hours, consistently
free weekdays, and planning lead time. Ideal for answering "how is my
schedule looking" or generating a weekly review.`,
    {
      ...ANALYTICS_RANGE_SHAPE,
      include_category_names: z
        .boolean()
        .optional()
        .describe(
          'Resolve category ids to names (requires the categories:read scope)',
        ),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_EVENTS_READ)
      if (params.include_category_names) {
        requireScope(extra.authInfo, SCOPE_CATEGORIES_READ)
      }
      const userId = getUserId(extra.authInfo)
      try {
        const { getAnalyticsInsights } = await import('./analytics-tools')
        return respond(await getAnalyticsInsights(userId, params))
      } catch (err) {
        if (err instanceof InvalidEventQueryError) return respondCliError(err)
        return respondError(err)
      }
    },
  )
}

function registerEventTools(server: LegacyToolServer): void {
  server.tool(
    'list_events',
    `List calendar events with structured filtering, full-text search, sorting,
field selection and pagination. Filter conditions are AND-ed; values within a
single array are OR-ed. Ranges match events that overlap the interval.`,
    {
      start_date: z.string().optional().describe('Start date (ISO 8601)'),
      end_date: z.string().optional().describe('End date (ISO 8601)'),
      query: z.string().optional().describe('Search keyword'),
      page: z.number().optional().describe('Page number'),
      limit: z.number().optional().describe('Items per page (max 100)'),
      filter: z
        .object({
          time: z
            .object({
              start: z
                .string()
                .optional()
                .describe('ISO 8601, inclusive lower bound'),
              end: z
                .string()
                .optional()
                .describe('ISO 8601, exclusive upper bound'),
              preset: z
                .enum(TIME_PRESET_OPTIONS)
                .optional()
                .describe(
                  'Relative time preset; cannot be combined with start/end (weeks start on Monday)',
                ),
              timezone: z
                .string()
                .optional()
                .describe(
                  'IANA timezone for interpreting presets (defaults to user settings timezone)',
                ),
            })
            .optional(),
          category_ids: z.array(z.string()).optional(),
          colors: z
            .array(z.string())
            .optional()
            .describe('Color names, hex codes, or stored color values'),
          status: z.array(z.enum(EVENT_STATUS_OPTIONS)).optional(),
          is_all_day: z.boolean().optional(),
          participants: z
            .object({
              emails: z.array(z.string().email()).optional(),
              mode: z
                .enum(['any', 'all'])
                .optional()
                .describe('"all" requires the event to include every email'),
              exists: z
                .boolean()
                .optional()
                .describe('true: has participants, false: has none'),
            })
            .optional(),
        })
        .optional(),
      search: z
        .object({
          text: z.string().describe('Search text'),
          fields: z
            .array(z.enum(EVENT_SEARCH_FIELDS))
            .optional()
            .describe(
              'Fields to search (default: title, description, location)',
            ),
        })
        .optional(),
      sort: z
        .object({
          field: z.enum(EVENT_SORT_FIELDS),
          direction: z.enum(['asc', 'desc']).optional(),
        })
        .optional()
        .describe('Default: start_date asc with id as stable tiebreaker'),
      fields: z
        .array(z.string())
        .optional()
        .describe('Whitelist of fields to return; id is always included'),
      pagination: z
        .object({
          page: z.number().optional(),
          limit: z.number().optional(),
        })
        .optional(),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_EVENTS_READ)
      const userId = getUserId(extra.authInfo)
      try {
        const { listEvents } = await import('./event-tools')
        return respond(
          await listEvents(userId, {
            start_date: params.start_date,
            end_date: params.end_date,
            query: params.query,
            page: params.page,
            limit: params.limit,
            filter: params.filter,
            search: params.search,
            sort: params.sort,
            fields: params.fields,
            pagination: params.pagination,
          }),
        )
      } catch (err) {
        if (err instanceof InvalidEventQueryError) return respondCliError(err)
        return respondError(err)
      }
    },
  )

  server.tool(
    'get_event',
    'Get detailed information about a single event (plain event, series, or recurring instance)',
    {
      event_id: z
        .string()
        .describe(
          'Event ID of a plain event, series, or a recurring instance (instance IDs look like <seriesId>_<recurrenceId>)',
        ),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_EVENTS_READ)
      const userId = getUserId(extra.authInfo)
      try {
        const { getEvent } = await import('./event-tools')
        const result = await getEvent(userId, params.event_id)
        if (!result) return respondMessage('Event not found')
        return respond(result)
      } catch (err) {
        return respondError(err)
      }
    },
  )

  server.tool(
    'create_event',
    'Create a new calendar event (optionally a recurring series)',
    {
      title: z.string().describe('Event title'),
      description: z.string().optional().describe('Event description'),
      location: z.string().optional().describe('Location'),
      start_date: z.string().describe('Start time (ISO 8601)'),
      end_date: z.string().describe('End time (ISO 8601)'),
      is_all_day: z.boolean().optional().default(false),
      status: z
        .enum(EVENT_STATUS_OPTIONS)
        .optional()
        .default('confirmed')
        .describe('Event status (default: confirmed)'),
      color: COLOR_SCHEMA.describe(COLOR_DESCRIPTION),
      category_id: z.string().optional(),
      notification_minutes: z.number().optional(),
      email_reminder: z
        .boolean()
        .optional()
        .describe(
          "Also deliver the reminder by email. Consumes the user's daily reminder-email allowance (5 per day).",
        ),
      rrule: z
        .string()
        .optional()
        .describe(
          'RFC 5545 RRULE (e.g. FREQ=WEEKLY;INTERVAL=1) to make this a recurring series',
        ),
      exdate: z
        .array(z.string())
        .optional()
        .describe('RFC 5545 DATE-TIME stamps of occurrences to exclude'),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_EVENTS_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { createEvent } = await import('./event-tools')
        return respond(await createEvent(userId, params))
      } catch (err) {
        // A reminder-quota refusal is user-facing, not an internal error.
        if (err instanceof ParticipantError) return respondCliError(err)
        return respondError(err)
      }
    },
  )

  server.tool(
    'update_event',
    'Update an existing event (plain event, recurring series, or occurrence)',
    {
      event_id: z
        .string()
        .describe(
          'Event ID of a plain event, series, or a recurring instance (instance IDs look like <seriesId>_<recurrenceId>)',
        ),
      title: z.string().optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
      is_all_day: z.boolean().optional(),
      status: z.enum(EVENT_STATUS_OPTIONS).optional(),
      color: COLOR_SCHEMA.optional().describe(COLOR_DESCRIPTION),
      category_id: z.string().optional(),
      notification_minutes: z.number().optional(),
      email_reminder: z
        .boolean()
        .optional()
        .describe(
          "Also deliver the reminder by email. Consumes the user's daily reminder-email allowance (5 per day).",
        ),
      rrule: z
        .string()
        .optional()
        .describe('RFC 5545 RRULE; applies when editing the whole series'),
      exdate: z
        .array(z.string())
        .optional()
        .describe('RFC 5545 DATE-TIME stamps of occurrences to exclude'),
      apply_to: z
        .enum(['all', 'single', 'following'])
        .optional()
        .describe(
          'all: whole series (default for a series ID), single: one occurrence (default for an instance ID), following: this and all future occurrences',
        ),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_EVENTS_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { updateEvent } = await import('./event-tools')
        const { event_id, ...data } = params
        const result = await updateEvent(userId, event_id, data)
        if (!result) return respondMessage('Event not found')
        return respond(result)
      } catch (err) {
        // A reminder-quota refusal is a user-facing 4xx, not an internal error;
        // respondError would flatten it to 'Internal server error'.
        if (err instanceof ParticipantError) return respondCliError(err)
        return respondError(err)
      }
    },
  )

  server.tool(
    'delete_event',
    'Delete an event (plain event, recurring series, or occurrence)',
    {
      event_id: z
        .string()
        .describe(
          'Event ID of a plain event, series, or a recurring instance (instance IDs look like <seriesId>_<recurrenceId>)',
        ),
      apply_to: z
        .enum(['all', 'single', 'following'])
        .optional()
        .describe(
          'all: whole series (default for a series ID), single: one occurrence (default for an instance ID), following: this and all future occurrences',
        ),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_EVENTS_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { deleteEvent } = await import('./event-tools')
        await deleteEvent(userId, params.event_id, params.apply_to)
        return respondMessage('Event deleted')
      } catch (err) {
        return respondError(err)
      }
    },
  )
}

function registerEventParticipantTools(server: LegacyToolServer): void {
  server.tool(
    'add_event_participants',
    'Invite participants to an event. Sends invitation emails by default. For a recurring event, accepts an occurrence id and an apply_to scope; re-adding someone previously removed reuses their original invite link and sends no new email.',
    {
      event_id: z
        .string()
        .describe(
          'Event ID, or an occurrence id ({seriesId}_{stamp}) to act from one occurrence',
        ),
      emails: z
        .array(z.string().email())
        .min(1)
        .max(20)
        .describe('Participant emails'),
      send_email: z
        .boolean()
        .optional()
        .default(true)
        .describe('Send invitation emails (default true)'),
      apply_to: z
        .enum(['single', 'following', 'all'])
        .optional()
        .describe(
          "Which occurrences to invite to (default all). 'all' is only permitted on the series' first occurrence.",
        ),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_EVENTS_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { addEventParticipants } = await import('./participant-tools')
        return respond(
          await addEventParticipants(
            userId,
            params.event_id,
            params.emails,
            params.send_email ?? true,
            params.apply_to ?? 'all',
          ),
        )
      } catch (err) {
        if (err instanceof ParticipantError) return respondCliError(err)
        return respondError(err)
      }
    },
  )

  server.tool(
    'resend_event_invite',
    'Resend the invitation email to an existing participant',
    {
      event_id: z.string().describe('Event ID (must be owned by the caller)'),
      email: z.string().email().describe('Participant email'),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_EVENTS_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { resendEventInvite } = await import('./participant-tools')
        return respond(
          await resendEventInvite(userId, params.event_id, params.email),
        )
      } catch (err) {
        if (err instanceof ParticipantError) return respondCliError(err)
        return respondError(err)
      }
    },
  )

  server.tool(
    'remove_event_participant',
    'Remove a participant (invite) from an event. For a recurring event, accepts an occurrence id and an apply_to scope.',
    {
      event_id: z
        .string()
        .describe(
          'Event ID, or an occurrence id ({seriesId}_{stamp}) to act from one occurrence',
        ),
      email: z.string().email().describe('Participant email to remove'),
      apply_to: z
        .enum(['single', 'following', 'all'])
        .optional()
        .describe(
          "Which occurrences to remove from (default all). 'all' is only permitted on the series' first occurrence.",
        ),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_EVENTS_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { removeEventParticipant } = await import('./participant-tools')
        return respond(
          await removeEventParticipant(
            userId,
            params.event_id,
            params.email,
            params.apply_to ?? 'all',
          ),
        )
      } catch (err) {
        if (err instanceof ParticipantError) return respondCliError(err)
        return respondError(err)
      }
    },
  )

  server.tool(
    'list_event_participants',
    'List all participants (invites) of an event',
    {
      event_id: z.string().describe('Event ID (must be owned by the caller)'),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_EVENTS_READ)
      const userId = getUserId(extra.authInfo)
      try {
        const { listEventParticipants } = await import('./participant-tools')
        return respond(await listEventParticipants(userId, params.event_id))
      } catch (err) {
        if (err instanceof ParticipantError) return respondCliError(err)
        return respondError(err)
      }
    },
  )

  server.tool(
    'update_event_rsvp',
    'Set your RSVP status for an event you were invited to (uses your own invite link). Each occurrence of a recurring event carries its own RSVP, so pass recurrence_id to answer one.',
    {
      invite_token: z.string().describe('Your invite token'),
      status: z
        .enum(['pending', 'accepted', 'maybe', 'declined'])
        .describe('New RSVP status'),
      recurrence_id: z
        .string()
        .optional()
        .describe(
          'RFC stamp of the occurrence to answer (YYYYMMDD or YYYYMMDDTHHMMSSZ). Required for a recurring event.',
        ),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_EVENTS_WRITE)
      const userEmail = getUserEmail(extra.authInfo)
      try {
        const { updateInviteRsvp } = await import('./participant-tools')
        return respond(
          await updateInviteRsvp(
            userEmail,
            params.invite_token,
            params.status,
            params.recurrence_id,
          ),
        )
      } catch (err) {
        if (err instanceof ParticipantError) return respondCliError(err)
        return respondError(err)
      }
    },
  )

  server.tool(
    'remove_event_from_my_calendar',
    'Remove an invited event from your own calendar (does not affect the inviter)',
    {
      invite_token: z.string().describe('Your invite token'),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_EVENTS_WRITE)
      const userEmail = getUserEmail(extra.authInfo)
      try {
        const { removeEventFromMyCalendar } =
          await import('./participant-tools')
        return respond(
          await removeEventFromMyCalendar(userEmail, params.invite_token),
        )
      } catch (err) {
        if (err instanceof ParticipantError) return respondCliError(err)
        return respondError(err)
      }
    },
  )

  server.tool(
    'list_my_event_invites',
    'List all events you have been invited to, with your RSVP status and invite links. For a recurring event, RSVPs are per occurrence and reported in occurrence_rsvps; rsvp_status is null',
    {
      status: z
        .enum(['pending', 'accepted', 'maybe', 'declined'])
        .optional()
        .describe(
          'Filter by RSVP status. Only meaningful for non-recurring events — a series has no series-wide RSVP',
        ),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_EVENTS_READ)
      const userEmail = getUserEmail(extra.authInfo)
      try {
        const { listMyEventInvites } = await import('./participant-tools')
        return respond(await listMyEventInvites(userEmail, params.status))
      } catch (err) {
        if (err instanceof ParticipantError) return respondCliError(err)
        return respondError(err)
      }
    },
  )
}

function registerCategoryTools(server: LegacyToolServer): void {
  server.tool(
    'list_categories',
    'List all categories',
    {},
    async (_params, extra) => {
      requireScope(extra.authInfo, SCOPE_CATEGORIES_READ)
      const userId = getUserId(extra.authInfo)
      try {
        const { listCategories } = await import('./category-tools')
        return respond(await listCategories(userId))
      } catch (err) {
        return respondError(err)
      }
    },
  )

  server.tool(
    'create_category',
    'Create a new category',
    {
      name: z.string().describe('Category name'),
      color: z.enum(CATEGORY_COLOR_VALUES).describe('Category color'),
      sort_order: z.number().optional().default(0),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_CATEGORIES_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { createCategory } = await import('./category-tools')
        return respond(await createCategory(userId, params))
      } catch (err) {
        return respondError(err)
      }
    },
  )

  server.tool(
    'update_category',
    'Update a category',
    {
      category_id: z.string(),
      name: z.string().optional(),
      color: COLOR_SCHEMA.optional().describe(COLOR_DESCRIPTION),
      sort_order: z.number().optional(),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_CATEGORIES_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { updateCategory } = await import('./category-tools')
        const { category_id, ...data } = params
        const result = await updateCategory(userId, category_id, data)
        if (!result) return respondMessage('Category not found')
        return respond(result)
      } catch (err) {
        return respondError(err)
      }
    },
  )

  server.tool(
    'delete_category',
    'Delete a category',
    { category_id: z.string() },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_CATEGORIES_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { deleteCategory } = await import('./category-tools')
        await deleteCategory(userId, params.category_id)
        return respondMessage('Category deleted')
      } catch (err) {
        return respondError(err)
      }
    },
  )
}

function registerCountdownTools(server: LegacyToolServer): void {
  server.tool(
    'list_countdown_icons',
    `List the icon names accepted by create_countdown and update_countdown,
grouped by occasion. Any other value is rejected.`,
    {},
    async (_params, extra) => {
      requireScope(extra.authInfo, SCOPE_COUNTDOWNS_READ)
      return respond({
        groups: COUNTDOWN_ICON_GROUPS.map((group) => ({
          group: group.label,
          icons: group.icons,
        })),
        total: COUNTDOWN_ICON_NAMES.length,
      })
    },
  )

  server.tool(
    'list_countdowns',
    'List all countdowns',
    {
      page: z.number().optional().default(1).describe('Page number'),
      limit: z
        .number()
        .optional()
        .default(50)
        .describe('Items per page (max 50)'),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_COUNTDOWNS_READ)
      const userId = getUserId(extra.authInfo)
      try {
        const { listCountdowns } = await import('./countdown-tools')
        return respond(
          await listCountdowns(
            userId,
            params.page ?? 1,
            Math.min(params.limit ?? 50, 50),
          ),
        )
      } catch (err) {
        return respondError(err)
      }
    },
  )

  server.tool(
    'create_countdown',
    'Create a new countdown',
    {
      name: z.string().describe('Countdown name'),
      target_date: z.string().describe('Target date (ISO 8601)'),
      description: z.string().optional(),
      color: COLOR_SCHEMA.describe(COLOR_DESCRIPTION),
      icon: COUNTDOWN_ICON_SCHEMA.optional().describe(
        COUNTDOWN_ICON_DESCRIPTION,
      ),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_COUNTDOWNS_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { createCountdown } = await import('./countdown-tools')
        return respond(await createCountdown(userId, params))
      } catch (err) {
        return respondError(err)
      }
    },
  )

  server.tool(
    'update_countdown',
    'Update a countdown',
    {
      countdown_id: z.string(),
      name: z.string().optional(),
      target_date: z.string().optional(),
      description: z.string().optional(),
      color: COLOR_SCHEMA.optional().describe(COLOR_DESCRIPTION),
      icon: COUNTDOWN_ICON_SCHEMA.optional().describe(
        COUNTDOWN_ICON_DESCRIPTION,
      ),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_COUNTDOWNS_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { updateCountdown } = await import('./countdown-tools')
        const { countdown_id, ...data } = params
        const result = await updateCountdown(userId, countdown_id, data)
        if (!result) return respondMessage('Countdown not found')
        return respond(result)
      } catch (err) {
        return respondError(err)
      }
    },
  )

  server.tool(
    'delete_countdown',
    'Delete a countdown',
    { countdown_id: z.string() },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_COUNTDOWNS_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { deleteCountdown } = await import('./countdown-tools')
        await deleteCountdown(userId, params.countdown_id)
        return respondMessage('Countdown deleted')
      } catch (err) {
        return respondError(err)
      }
    },
  )
}

function registerSettingsTools(server: LegacyToolServer): void {
  server.tool(
    'get_settings',
    'Get user settings',
    {},
    async (_params, extra) => {
      requireScope(extra.authInfo, SCOPE_SETTINGS_READ)
      const userId = getUserId(extra.authInfo)
      try {
        const { getSettings } = await import('./settings-tools')
        return respond(await getSettings(userId))
      } catch (err) {
        return respondError(err)
      }
    },
  )

  server.tool(
    'update_settings',
    'Update user settings',
    {
      language: z.enum(LANGUAGE_OPTIONS).optional(),
      timezone: z.string().optional(),
      default_view: z.enum(DEFAULT_VIEW_OPTIONS).optional(),
      time_format: z.enum(TIME_FORMAT_OPTIONS).optional(),
      first_day_of_week: z
        .union([z.literal(0), z.literal(1), z.literal(6)])
        .optional(),
      theme: z.enum(THEME_OPTIONS).optional(),
      enable_shortcuts: z.boolean().optional(),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_SETTINGS_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { updateSettings } = await import('./settings-tools')
        await updateSettings(userId, params)
        return respondMessage('Settings updated')
      } catch (err) {
        return respondError(err)
      }
    },
  )
}

function registerProfileTool(server: LegacyToolServer): void {
  server.tool(
    'get_profile',
    'Get current user info (name, email, etc.)',
    {},
    async (_params, extra) => {
      requireScope(extra.authInfo, SCOPE_PROFILE_READ)
      const userId = getUserId(extra.authInfo)
      try {
        const { getProfile } = await import('./profile-tools')
        return respond(await getProfile(userId))
      } catch (err) {
        return respondError(err)
      }
    },
  )
}

function registerBookmarkTools(server: LegacyToolServer): void {
  server.tool(
    'bookmark_event',
    'Bookmark an event so it can be found quickly later',
    { event_id: z.string().describe('Event ID') },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_BOOKMARKS_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { bookmarkEvent } = await import('./bookmark-tools')
        return respond(
          await bookmarkEvent(userId, { eventId: params.event_id }),
        )
      } catch (err) {
        if (err instanceof InvalidEventQueryError) return respondCliError(err)
        return respondError(err)
      }
    },
  )

  server.tool(
    'list_bookmarked_events',
    'List events you have bookmarked, newest first',
    {
      event_id: z.string().optional().describe('Filter by event ID'),
      page: z.number().optional().describe('Page number'),
      limit: z.number().optional().describe('Items per page (max 100)'),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_BOOKMARKS_READ)
      const userId = getUserId(extra.authInfo)
      try {
        const { listBookmarkedEvents } = await import('./bookmark-tools')
        return respond(
          await listBookmarkedEvents(userId, {
            eventId: params.event_id,
            page: params.page,
            limit: params.limit,
          }),
        )
      } catch (err) {
        return respondError(err)
      }
    },
  )

  server.tool(
    'remove_bookmark',
    'Remove a bookmark from an event',
    { event_id: z.string().describe('Event ID') },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_BOOKMARKS_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { removeBookmark } = await import('./bookmark-tools')
        return respond(
          await removeBookmark(userId, { eventId: params.event_id }),
        )
      } catch (err) {
        return respondError(err)
      }
    },
  )
}
