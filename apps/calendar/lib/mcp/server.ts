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

function getUserId(authInfo?: AuthInfo): string {
  const id = authInfo?.extra?.userId as string | undefined
  if (!id) throw new Error('Unauthorized')
  return id
}

function hasScope(authInfo: AuthInfo | undefined, scope: string): boolean {
  return authInfo?.scopes?.includes(scope) ?? false
}

function requireScope(authInfo: AuthInfo | undefined, scope: string): void {
  if (!hasScope(authInfo, scope)) {
    throw new Error(`Missing required scope: ${scope}`)
  }
}

function getClientId(authInfo?: AuthInfo): string {
  return (authInfo?.extra?.clientId as string) ?? 'unknown'
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
    '查询日历事件列表，可按时间范围、关键字搜索',
    {
      start_date: z.string().optional().describe('开始日期 (ISO 8601)'),
      end_date: z.string().optional().describe('结束日期 (ISO 8601)'),
      query: z.string().optional().describe('搜索关键字'),
      page: z.number().optional().default(1).describe('页码'),
      limit: z.number().optional().default(50).describe('每页数量 (最大 50)'),
    },
    async (params, extra) => {
      const authInfo = extra.authInfo
      requireScope(authInfo, SCOPE_EVENTS_READ)
      const userId = getUserId(authInfo)
      try {
        const { listEvents } = await import('./event-tools')
        const result = await listEvents(
          userId,
          params.start_date,
          params.end_date,
          params.query,
          params.page ?? 1,
          Math.min(params.limit ?? 50, 50),
        )
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'get_event',
    '获取单个事件的详细信息',
    {
      event_id: z.string().describe('事件 ID'),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_EVENTS_READ)
      const userId = getUserId(extra.authInfo)
      try {
        const { getEvent } = await import('./event-tools')
        const result = await getEvent(userId, params.event_id)
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: 'Event not found' }],
            isError: true,
          }
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'create_event',
    '创建新的日历事件',
    {
      title: z.string().describe('事件标题'),
      description: z.string().optional().describe('事件描述'),
      location: z.string().optional().describe('地点'),
      start_date: z.string().describe('开始时间 (ISO 8601)'),
      end_date: z.string().describe('结束时间 (ISO 8601)'),
      is_all_day: z.boolean().optional().default(false),
      color: z.string().optional().describe('颜色 (十六进制)'),
      category_id: z.string().optional(),
      notification_minutes: z.number().optional(),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_EVENTS_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { createEvent } = await import('./event-tools')
        const result = await createEvent(userId, params)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'update_event',
    '修改已有的事件',
    {
      event_id: z.string().describe('事件 ID'),
      title: z.string().optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
      is_all_day: z.boolean().optional(),
      color: z.string().optional(),
      category_id: z.string().optional(),
      notification_minutes: z.number().optional(),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_EVENTS_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { updateEvent } = await import('./event-tools')
        const result = await updateEvent(userId, params.event_id, params)
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: 'Event not found' }],
            isError: true,
          }
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'delete_event',
    '删除一个事件',
    {
      event_id: z.string().describe('事件 ID'),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_EVENTS_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { deleteEvent } = await import('./event-tools')
        await deleteEvent(userId, params.event_id)
        return { content: [{ type: 'text' as const, text: 'Event deleted' }] }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err}` }],
          isError: true,
        }
      }
    },
  )
}

function registerCategoryTools(server: McpServer): void {
  server.tool('list_categories', '查询所有分类', {}, async (_params, extra) => {
    requireScope(extra.authInfo, SCOPE_CATEGORIES_READ)
    const userId = getUserId(extra.authInfo)
    try {
      const { listCategories } = await import('./category-tools')
      const result = await listCategories(userId)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      }
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${err}` }],
        isError: true,
      }
    }
  })

  server.tool(
    'create_category',
    '创建新分类',
    {
      name: z.string().describe('分类名称'),
      color: z.string().describe('颜色 (十六进制)'),
      sort_order: z.number().optional().default(0),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_CATEGORIES_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { createCategory } = await import('./category-tools')
        const result = await createCategory(userId, params)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'update_category',
    '修改分类',
    {
      category_id: z.string(),
      name: z.string().optional(),
      color: z.string().optional(),
      sort_order: z.number().optional(),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_CATEGORIES_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { updateCategory } = await import('./category-tools')
        const result = await updateCategory(userId, params.category_id, params)
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: 'Category not found' }],
            isError: true,
          }
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'delete_category',
    '删除分类',
    {
      category_id: z.string(),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_CATEGORIES_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { deleteCategory } = await import('./category-tools')
        await deleteCategory(userId, params.category_id)
        return {
          content: [{ type: 'text' as const, text: 'Category deleted' }],
        }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err}` }],
          isError: true,
        }
      }
    },
  )
}

function registerCountdownTools(server: McpServer): void {
  server.tool(
    'list_countdowns',
    '查询所有倒计时',
    {},
    async (_params, extra) => {
      requireScope(extra.authInfo, SCOPE_COUNTDOWNS_READ)
      const userId = getUserId(extra.authInfo)
      try {
        const { listCountdowns } = await import('./countdown-tools')
        const result = await listCountdowns(userId)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'create_countdown',
    '创建新的倒计时',
    {
      name: z.string().describe('倒计时名称'),
      target_date: z.string().describe('目标日期 (ISO 8601)'),
      description: z.string().optional(),
      color: z.string().optional(),
      icon: z.string().optional(),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_COUNTDOWNS_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { createCountdown } = await import('./countdown-tools')
        const result = await createCountdown(userId, params)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'update_countdown',
    '修改倒计时',
    {
      countdown_id: z.string(),
      name: z.string().optional(),
      target_date: z.string().optional(),
      description: z.string().optional(),
      color: z.string().optional(),
      icon: z.string().optional(),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_COUNTDOWNS_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { updateCountdown } = await import('./countdown-tools')
        const result = await updateCountdown(
          userId,
          params.countdown_id,
          params,
        )
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: 'Countdown not found' }],
            isError: true,
          }
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'delete_countdown',
    '删除倒计时',
    {
      countdown_id: z.string(),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_COUNTDOWNS_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { deleteCountdown } = await import('./countdown-tools')
        await deleteCountdown(userId, params.countdown_id)
        return {
          content: [{ type: 'text' as const, text: 'Countdown deleted' }],
        }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err}` }],
          isError: true,
        }
      }
    },
  )
}

function registerSettingsTools(server: McpServer): void {
  server.tool('get_settings', '获取用户设置', {}, async (_params, extra) => {
    requireScope(extra.authInfo, SCOPE_SETTINGS_READ)
    const userId = getUserId(extra.authInfo)
    try {
      const { getSettings } = await import('./settings-tools')
      const result = await getSettings(userId)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      }
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${err}` }],
        isError: true,
      }
    }
  })

  server.tool(
    'update_settings',
    '更新用户设置',
    {
      language: z.string().optional(),
      timezone: z.string().optional(),
      default_view: z.string().optional(),
      time_format: z.string().optional(),
      first_day_of_week: z.number().optional(),
      theme: z.string().optional(),
      enable_shortcuts: z.boolean().optional(),
    },
    async (params, extra) => {
      requireScope(extra.authInfo, SCOPE_SETTINGS_WRITE)
      const userId = getUserId(extra.authInfo)
      try {
        const { updateSettings } = await import('./settings-tools')
        await updateSettings(userId, params)
        return {
          content: [{ type: 'text' as const, text: 'Settings updated' }],
        }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err}` }],
          isError: true,
        }
      }
    },
  )
}

function registerProfileTool(server: McpServer): void {
  server.tool(
    'get_profile',
    '获取当前用户信息（名称、邮箱等）',
    {},
    async (_params, extra) => {
      requireScope(extra.authInfo, SCOPE_PROFILE_READ)
      const userId = getUserId(extra.authInfo)
      try {
        const { getProfile } = await import('./profile-tools')
        const result = await getProfile(userId)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err}` }],
          isError: true,
        }
      }
    },
  )
}
