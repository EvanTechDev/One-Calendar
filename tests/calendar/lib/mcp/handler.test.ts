import { describe, it, expect, beforeEach, vi } from 'vitest'
import { handleMcpRequest } from '@/lib/mcp/handler'

const mocks = vi.hoisted(() => ({
  getMcpAuth: vi.fn(),
  getMcpSettings: vi.fn(),
  checkRateLimit: vi.fn(),
  logAudit: vi.fn(),
  handleRequest: vi.fn(),
  connect: vi.fn(),
}))

vi.mock('@/lib/mcp/auth-helpers', () => ({
  getMcpAuth: mocks.getMcpAuth,
}))

vi.mock('@/lib/mcp/settings', () => ({
  getMcpSettings: mocks.getMcpSettings,
}))

vi.mock('@/lib/mcp/rate-limiter', () => ({
  checkRateLimit: mocks.checkRateLimit,
}))

vi.mock('@/lib/mcp/audit', () => ({
  logAudit: mocks.logAudit,
}))

vi.mock('@/lib/mcp/server', () => ({
  createServer: () => ({ connect: mocks.connect }),
}))

vi.mock(
  '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js',
  () => ({
    WebStandardStreamableHTTPServerTransport: class {
      handleRequest(...args: unknown[]) {
        return mocks.handleRequest(...args)
      }
    },
  }),
)

const AUTH = {
  token: 'tok-123',
  user: {
    userId: 'user-1',
    email: 'a@example.com',
    name: 'A',
    scopes: ['events:read'],
    authType: 'api_key' as const,
    keyId: 'key-1',
  },
}

function req(method: 'GET' | 'POST', headers: Record<string, string> = {}) {
  return new Request('https://app.example.com/api/mcp', { method, headers })
}

describe('handleMcpRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMcpAuth.mockResolvedValue(AUTH)
    mocks.getMcpSettings.mockResolvedValue({ enabled: true, rateLimitRpm: 60 })
    mocks.checkRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 59,
      resetAt: Date.now() + 60_000,
    })
    mocks.handleRequest.mockResolvedValue(new Response('ok', { status: 200 }))
    mocks.connect.mockResolvedValue(undefined)
  })

  it('rejects an unauthenticated GET with 401 and never opens a transport', async () => {
    mocks.getMcpAuth.mockResolvedValue(null)

    const res = await handleMcpRequest(req('GET'))

    expect(res.status).toBe(401)
    expect(res.headers.get('WWW-Authenticate')).toBe('Bearer')
    expect(mocks.handleRequest).not.toHaveBeenCalled()
  })

  it('rejects a GET when MCP is disabled for the account', async () => {
    mocks.getMcpSettings.mockResolvedValue({ enabled: false, rateLimitRpm: 60 })

    const res = await handleMcpRequest(req('GET'))

    expect(res.status).toBe(403)
    expect(mocks.handleRequest).not.toHaveBeenCalled()
  })

  it('rejects a GET over the rate limit and audits it', async () => {
    mocks.checkRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30_000,
    })

    const res = await handleMcpRequest(req('GET'))

    expect(res.status).toBe(429)
    expect(mocks.handleRequest).not.toHaveBeenCalled()
    expect(mocks.logAudit).toHaveBeenCalledTimes(1)
    expect(mocks.logAudit.mock.calls[0]?.[0]).toMatchObject({
      action: 'rate_limited',
    })
  })

  it('serves an authorized GET with the rich authInfo', async () => {
    const res = await handleMcpRequest(
      req('GET', {
        'cf-connecting-ip': '203.0.113.7',
        'user-agent': 'test-agent',
      }),
    )

    expect(res.status).toBe(200)
    expect(mocks.handleRequest).toHaveBeenCalledTimes(1)

    const passed = mocks.handleRequest.mock.calls[0]?.[1] as {
      authInfo: { extra: Record<string, unknown> }
    }
    expect(passed.authInfo.extra).toMatchObject({
      userId: 'user-1',
      keyId: 'key-1',
      ipAddress: '203.0.113.7',
      userAgent: 'test-agent',
    })
  })

  it('still serves an authorized POST and writes one request audit row', async () => {
    const res = await handleMcpRequest(req('POST'))

    expect(res.status).toBe(200)
    expect(mocks.handleRequest).toHaveBeenCalledTimes(1)
    expect(mocks.logAudit).toHaveBeenCalledTimes(1)
    expect(mocks.logAudit.mock.calls[0]?.[0]).toMatchObject({
      entryType: 'request',
      action: 'mcp_request',
    })
  })
})
