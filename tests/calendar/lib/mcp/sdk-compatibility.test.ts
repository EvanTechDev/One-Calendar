// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SUPPORTED_PROTOCOL_VERSIONS } from '@modelcontextprotocol/server'
import { handleMcpRequest } from '@/lib/mcp/handler'
import type { McpAuthUser } from '@zntr/ui/calendar/lib/mcp/types'

// Keep the real transport, registration, JSON Schema conversion and tool
// dispatch. Only storage/rate-limit boundaries are replaced.
vi.mock('@/lib/mcp/settings', () => ({
  getMcpSettings: async () => ({ enabled: true }),
}))
vi.mock('@/lib/mcp/rate-limiter', () => ({
  checkRateLimit: async () => ({ allowed: true }),
}))
vi.mock('@/lib/mcp/audit', () => ({ logAudit: vi.fn() }))
vi.mock('@/lib/drizzle/client', () => ({
  getDb: () => {
    throw new Error('This SDK compatibility test must not access the database')
  },
}))

beforeEach(() => {
  vi.stubEnv('BETTER_AUTH_URL', 'https://calendar.example')
  vi.stubEnv('MCP_PUBLIC_BASE_URL', 'https://calendar.example')
})
afterEach(() => vi.unstubAllEnvs())

const AUTH = {
  token: 'test-token',
  user: {
    userId: 'test-user',
    email: 'test@example.com',
    name: 'Test',
    authType: 'api_key',
    scopes: ['countdowns:read'],
    keyId: 'test-key',
  } satisfies McpAuthUser,
}

async function rpc(
  method: string,
  params: Record<string, unknown> = {},
  notification = false,
) {
  return handleMcpRequest(
    new Request('https://calendar.example/api/mcp', {
      method: 'POST',
      headers: {
        host: 'calendar.example',
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': SUPPORTED_PROTOCOL_VERSIONS[0],
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        ...(notification ? {} : { id: 1 }),
        method,
        params,
      }),
    }),
    AUTH,
  )
}

it('initializes and calls real tools after the optional idle GET stream is declined', async () => {
  const initialized = await rpc('initialize', {
    protocolVersion: SUPPORTED_PROTOCOL_VERSIONS[0],
    capabilities: {},
    clientInfo: { name: 'streamable-http-compatibility', version: '1.0.0' },
  })
  expect(initialized.status).toBe(200)
  expect((await initialized.json()).result.protocolVersion).toBe(
    SUPPORTED_PROTOCOL_VERSIONS[0],
  )

  const acknowledged = await rpc('notifications/initialized', {}, true)
  expect(acknowledged.status).toBe(202)
  expect(acknowledged.body).toBeNull()

  const idle = await handleMcpRequest(
    new Request('https://calendar.example/api/mcp', {
      headers: {
        host: 'calendar.example',
        accept: 'text/event-stream',
        'mcp-protocol-version': SUPPORTED_PROTOCOL_VERSIONS[0],
      },
    }),
    AUTH,
  )
  expect(idle.status).toBe(405)
  expect(idle.headers.get('allow')).toBe('POST')
  expect(idle.body).toBeNull()

  const listed = await rpc('tools/list')
  expect(listed.status).toBe(200)
  const catalogue = await listed.json()
  expect(catalogue.error).toBeUndefined()
  expect(catalogue.result.tools).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: 'create_event',
        inputSchema: expect.objectContaining({ type: 'object' }),
      }),
    ]),
  )

  const called = await rpc('tools/call', {
    name: 'list_countdown_icons',
    arguments: {},
  })
  expect(called.status).toBe(200)
  const result = await called.json()
  expect(result.error).toBeUndefined()
  expect(result.result.isError).not.toBe(true)
  expect(JSON.parse(result.result.content[0].text).total).toBeGreaterThan(0)
})
