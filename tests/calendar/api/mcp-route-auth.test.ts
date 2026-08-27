// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getApiKey: vi.fn(),
  getOAuth: vi.fn(),
  handle: vi.fn(async () => new Response('mcp', { status: 200 })),
}))

vi.mock('@zntr/auth/server', () => ({
  requireMcpAuth:
    (_auth: unknown, handler: (request: Request, claims: unknown) => unknown) =>
    (request: Request) =>
      handler(request, {
        sub: 'user-1',
        client_id: 'client-1',
        scope: 'events:read',
      }),
}))

vi.mock('@/lib/auth', () => ({ auth: {} }))
vi.mock('@/lib/mcp/auth-helpers', () => ({
  getMcpApiKeyAuth: mocks.getApiKey,
  getMcpOAuthAuth: mocks.getOAuth,
}))
vi.mock('@/lib/mcp/handler', () => ({ handleMcpRequest: mocks.handle }))

const { GET, POST } = await import('@/app/api/mcp/route')

const user = {
  userId: 'user-1',
  email: 'ada@example.com',
  name: 'Ada',
  scopes: ['events:read'],
  authType: 'oauth' as const,
  keyId: 'client-1',
}

function request(token: string) {
  return new Request('https://calendar.example/api/mcp', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  })
}

function getRequest(token = '') {
  return new Request('https://calendar.example/api/mcp', {
    method: 'GET',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getOAuth.mockResolvedValue(user)
})

describe('MCP route authentication dispatch', () => {
  it('sends provider JWTs through Better Auth verification', async () => {
    const response = await POST(request('ey.jwt.token'))

    expect(response.status).toBe(200)
    expect(mocks.getOAuth).toHaveBeenCalled()
    expect(mocks.handle).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({ user, token: 'ey.jwt.token' }),
    )
    expect(mocks.getApiKey).not.toHaveBeenCalled()
  })

  it('preserves the zc_ API key path', async () => {
    mocks.getApiKey.mockResolvedValue({ user, token: 'zc_secret' })
    const response = await POST(request('zc_secret'))

    expect(response.status).toBe(200)
    expect(mocks.getApiKey).toHaveBeenCalled()
    expect(mocks.getOAuth).not.toHaveBeenCalled()
  })

  it('rejects a verified JWT after consent is revoked', async () => {
    mocks.getOAuth.mockResolvedValue(null)
    const response = await POST(request('ey.jwt.token'))

    expect(response.status).toBe(401)
    expect(response.headers.get('WWW-Authenticate')).toContain(
      'resource_metadata=',
    )
    expect(mocks.handle).not.toHaveBeenCalled()
  })

  it('returns an OAuth discovery challenge for unauthenticated GET', async () => {
    mocks.getOAuth.mockResolvedValue(null)
    const response = await GET(getRequest())

    expect(response.status).toBe(401)
    expect(response.headers.get('WWW-Authenticate')).toContain(
      'resource_metadata=',
    )
  })

  it('keeps authenticated GET available for compatible SSE clients', async () => {
    const response = await GET(getRequest('ey.jwt.token'))

    expect(response.status).toBe(200)
    expect(mocks.handle).toHaveBeenCalled()
  })
})
