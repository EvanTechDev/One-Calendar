import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { z } from 'zod'

const SCOPE_EVENTS_READ = 'events:read'
const SCOPE_EVENTS_WRITE = 'events:write'
const SCOPE_CATEGORIES_READ = 'categories:read'
const SCOPE_CATEGORIES_WRITE = 'categories:write'
const SCOPE_COUNTDOWNS_READ = 'countdowns:read'
const SCOPE_COUNTDOWNS_WRITE = 'countdowns:write'
const SCOPE_SETTINGS_READ = 'settings:read'
const SCOPE_SETTINGS_WRITE = 'settings:write'
const SCOPE_PROFILE_READ = 'profile:read'

const ALLOWED_HEX_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#6366F1',
  '#FB923C',
  '#14B8A6',
] as const

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

function requireScope(authInfo: AuthInfo | undefined, scope: string): void {
  if (!authInfo?.scopes?.includes(scope)) {
    throw new Error(`Missing required scope: ${scope}`)
  }
}

function respond(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] }
}

function respondError(err: unknown) {
  return {
    content: [{ type: 'text' as const, text: `Error: ${err}` }],
    isError: true as const,
  }
}

function respondMessage(msg: string) {
  return { content: [{ type: 'text' as const, text: msg }] }
}

export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'One Calendar MCP', version: '1.0.0' },
    { capabilities: { tools: {} } },
  )

  registerEventTools(server)
  registerCategoryTools(server)
  registerCountdownTools(server)
  registerSettingsTools(server)
  registerProfileTool(server)

  return server
}

function registerEventTools(server: McpServer): void {
  server.tool(
    'list_events',
    'List calendar events, filter by date range or keyword',
    {
      start_date: z.string().optional().describe('Start date (ISO 8601)'),
      end_date: z.string().optional().describe('End date (ISO 8601)'),
      query: z.string().optional().describe('Search keyword'),
      page: z.number().optional().default(1).describe('Page number'),
      limit: z
        .number()
        .optional()
        .default(50)
        .describe('Items per page (max 50)'),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_EVENTS_READ)
      const userId = getUserId(extra.authInfo)
      try {
        const { listEvents } = await import('./event-tools')
        return respond(
          await listEvents(
            userId,
            params.start_date,
            params.end_date,
            params.query,
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
    'get_event',
    'Get detailed information about a single event',
    { event_id: z.string().describe('Event ID') },
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
    'Create a new calendar event',
    {
      title: z.string().describe('Event title'),
      description: z.string().optional().describe('Event description'),
      location: z.string().optional().describe('Location'),
      start_date: z.string().describe('Start time (ISO 8601)'),
      end_date: z.string().describe('End time (ISO 8601)'),
      is_all_day: z.boolean().optional().default(false),
      color: z.enum(ALLOWED_HEX_COLORS).describe('Color'),
      category_id: z.string().optional(),
      notification_minutes: z.number().optional(),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_EVENTS_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { createEvent } = await import('./event-tools')
        return respond(await createEvent(userId, params))
      } catch (err) {
        return respondError(err)
      }
    },
  )

  server.tool(
    'update_event',
    'Update an existing event',
    {
      event_id: z.string().describe('Event ID'),
      title: z.string().optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
      is_all_day: z.boolean().optional(),
      color: z.enum(ALLOWED_HEX_COLORS).optional(),
      category_id: z.string().optional(),
      notification_minutes: z.number().optional(),
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
        return respondError(err)
      }
    },
  )

  server.tool(
    'delete_event',
    'Delete an event',
    { event_id: z.string().describe('Event ID') },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_EVENTS_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { deleteEvent } = await import('./event-tools')
        await deleteEvent(userId, params.event_id)
        return respondMessage('Event deleted')
      } catch (err) {
        return respondError(err)
      }
    },
  )
}

function registerCategoryTools(server: McpServer): void {
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
      color: z.enum(ALLOWED_HEX_COLORS).describe('Color'),
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
      color: z.enum(ALLOWED_HEX_COLORS).optional(),
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

function registerCountdownTools(server: McpServer): void {
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
      color: z.enum(ALLOWED_HEX_COLORS).describe('Color'),
      icon: z.string().optional(),
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
      color: z.enum(ALLOWED_HEX_COLORS).optional(),
      icon: z.string().optional(),
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

function registerSettingsTools(server: McpServer): void {
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

function registerProfileTool(server: McpServer): void {
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
