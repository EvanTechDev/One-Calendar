// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { drizzleOperatorsMock, getFakeDb } from './route-test-db'

vi.mock('drizzle-orm', async () => {
  const actual =
    await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm')
  return { ...actual, ...drizzleOperatorsMock }
})

vi.mock('@/lib/drizzle/client', () => ({ getDb: () => getFakeDb().db }))
vi.mock('@/lib/api-helpers', () => ({
  getAuthedUser: async () => ({ id: 'user-1', email: 'ada@example.com' }),
}))

const { GET, DELETE } = await import('@/app/api/mcp/authorized-apps/route')

beforeEach(() => {
  getFakeDb().reset()
  getFakeDb().seed(
    {
      id: 'client-row',
      clientId: 'client-1',
      name: 'Calendar CLI',
      disabled: false,
    },
    'oauthClient',
  )
  getFakeDb().seed(
    {
      id: 'consent-1',
      clientId: 'client-1',
      userId: 'user-1',
      scopes: ['events:read'],
      resources: ['https://calendar.example/api/mcp'],
      createdAt: new Date('2026-08-27T00:00:00Z'),
    },
    'oauthConsent',
  )
  getFakeDb().seed(
    {
      id: 'refresh-1',
      clientId: 'client-1',
      userId: 'user-1',
      revoked: null,
    },
    'oauthRefreshToken',
  )
  getFakeDb().seed(
    {
      id: 'access-1',
      clientId: 'client-1',
      userId: 'user-1',
      revoked: null,
    },
    'oauthAccessToken',
  )
})

describe('Connected Apps consent model', () => {
  it('lists one logical authorization per consent', async () => {
    const response = await GET()
    const body = await response.json()

    expect(body.apps).toEqual([
      expect.objectContaining({
        id: 'consent-1',
        clientId: 'client-1',
        clientName: 'Calendar CLI',
        scopes: ['events:read'],
      }),
    ])
  })

  it('deletes consent and revokes its token family atomically', async () => {
    getFakeDb().seed(
      {
        id: 'consent-duplicate',
        clientId: 'client-1',
        userId: 'user-1',
        scopes: ['events:read'],
        resources: ['https://calendar.example/api/mcp'],
      },
      'oauthConsent',
    )
    const response = await DELETE(
      new NextRequest('https://calendar.example/api/mcp/authorized-apps', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: 'consent-1' }),
      }),
    )

    expect(response.status).toBe(200)
    expect(getFakeDb().rows('oauthConsent')).toHaveLength(0)
    expect(getFakeDb().row('refresh-1', 'oauthRefreshToken')?.revoked).toEqual(
      expect.any(Date),
    )
    expect(getFakeDb().row('access-1', 'oauthAccessToken')?.revoked).toEqual(
      expect.any(Date),
    )
    expect(getFakeDb().ops).toEqual(
      expect.arrayContaining(['tx:begin', 'tx:commit']),
    )
  })
})
