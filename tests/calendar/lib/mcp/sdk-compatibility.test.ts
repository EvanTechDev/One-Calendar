// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SUPPORTED_PROTOCOL_VERSIONS } from '@modelcontextprotocol/server'
import { handleMcpRequest } from '@/lib/mcp/handler'

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

async function rpc(method: string, params: Record<string, unknown> = {}) {
  return handleMcpRequest(
    new Request('https://calendar.example/api/mcp', {
      method: 'POST',
      headers: {
        host: 'calendar.example',
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': SUPPORTED_PROTOCOL_VERSIONS[0],
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
    {
      token: 'test-token',
      user: {
        userId: 'test-user',
        email: 'test@example.com',
        name: 'Test',
        authType: 'api_key',
        scopes: ['countdowns:read'],
        keyId: 'test-key',
      },
    },
  )
}

it('lists the real tool schemas and dispatches an authenticated call on a fresh stateless request', async () => {
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
