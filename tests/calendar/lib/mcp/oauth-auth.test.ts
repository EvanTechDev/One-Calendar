// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { drizzleOperatorsMock, getFakeDb } from '../../api/route-test-db'

vi.mock('drizzle-orm', async () => {
  const actual =
    await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm')
  return { ...actual, ...drizzleOperatorsMock }
})

vi.mock('@/lib/drizzle/client', () => ({ getDb: () => getFakeDb().db }))

vi.mock('@/lib/mcp/auth', () => ({
  verifyApiKey: vi.fn(),
  getUserNameAndEmail: async () => ({
    name: 'Ada',
    email: 'ada@example.com',
  }),
}))

const { getMcpOAuthAuth } = await import('@/lib/mcp/auth-helpers')

const RESOURCE = 'https://calendar.example/api/mcp'
const claims = {
  sub: 'user-1',
  client_id: 'client-1',
  scope: 'events:read offline_access',
}

beforeEach(() => {
  getFakeDb().reset()
  getFakeDb().seed(
    { id: 'client-row', clientId: 'client-1', disabled: false },
    'oauthClient',
  )
  getFakeDb().seed(
    {
      id: 'consent-1',
      userId: 'user-1',
      clientId: 'client-1',
      resources: [RESOURCE],
      scopes: ['events:read', 'offline_access'],
    },
    'oauthConsent',
  )
})

describe('Better Auth MCP token claims', () => {
  it('maps an active audience-bound consent to MCP auth', async () => {
    await expect(getMcpOAuthAuth(claims, RESOURCE)).resolves.toEqual({
      userId: 'user-1',
      email: 'ada@example.com',
      name: 'Ada',
      scopes: ['events:read', 'offline_access'],
      authType: 'oauth',
      keyId: 'client-1',
    })
  })

  it('rejects immediately after consent deletion', async () => {
    getFakeDb().reset()
    getFakeDb().seed(
      { id: 'client-row', clientId: 'client-1', disabled: false },
      'oauthClient',
    )

    await expect(getMcpOAuthAuth(claims, RESOURCE)).resolves.toBeNull()
  })

  it('rejects a consent for another resource or insufficient scopes', async () => {
    expect(
      await getMcpOAuthAuth(claims, 'https://calendar.example/other'),
    ).toBeNull()
    expect(
      await getMcpOAuthAuth(
        { ...claims, scope: 'events:read events:write' },
        RESOURCE,
      ),
    ).toBeNull()
  })

  it('rejects a currently disabled client', async () => {
    getFakeDb().seed(
      { id: 'client-row', clientId: 'client-1', disabled: true },
      'oauthClient',
    )

    await expect(getMcpOAuthAuth(claims, RESOURCE)).resolves.toBeNull()
  })
})
