// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.setConfig({ testTimeout: 30_000 })

const state = vi.hoisted(() => ({
  session: { user: { id: 'user-1' } } as { user: { id: string } } | null,
  clients: [] as Array<{
    id: string
    isRevoked: boolean
    redirectUris: string[]
  }>,
}))

vi.mock('@/lib/auth/server', () => ({
  getServerSession: vi.fn(async () => state.session),
}))

vi.mock('@/lib/drizzle/client', () => ({
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: async (condition: { value?: unknown }) =>
          state.clients.filter((client) => client.id === condition.value),
      }),
    }),
  })),
}))

vi.mock('drizzle-orm', async () => {
  const actual =
    await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm')
  return {
    ...actual,
    eq: (_column: unknown, value: unknown) => ({ value }),
    and: (...conditions: unknown[]) => conditions[0],
    gte: (_column: unknown, value: unknown) => ({ value }),
  }
})

function request(clientId: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
  })
  return new NextRequest(`http://localhost/api/oauth/authorize?${params}`)
}

beforeEach(() => {
  state.session = { user: { id: 'user-1' } }
  state.clients = [
    {
      id: 'client-1',
      isRevoked: false,
      redirectUris: ['https://client.example/callback'],
    },
  ]
})

describe('GET OAuth callback validation', () => {
  it('returns only the exact registered callback', async () => {
    const { GET } = await import('@/app/api/oauth/authorize/route')
    const response = await GET(
      request('client-1', 'https://client.example/callback'),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      redirect_uri: 'https://client.example/callback',
    })
  })

  it.each([
    ['unknown client', 'unknown', 'https://client.example/callback'],
    ['unregistered origin', 'client-1', 'https://evil.example/callback'],
    ['script-capable uri', 'client-1', 'javascript:alert(1)'],
  ])('rejects %s', async (_label, clientId, redirectUri) => {
    const { GET } = await import('@/app/api/oauth/authorize/route')
    const response = await GET(request(clientId, redirectUri))

    expect(response.status).toBe(400)
    expect(await response.json()).not.toHaveProperty('code')
  })

  it('rejects a revoked client', async () => {
    state.clients[0]!.isRevoked = true
    const { GET } = await import('@/app/api/oauth/authorize/route')
    const response = await GET(
      request('client-1', 'https://client.example/callback'),
    )

    expect(response.status).toBe(400)
  })

  it('requires an authenticated session before client lookup', async () => {
    state.session = null
    const { GET } = await import('@/app/api/oauth/authorize/route')
    const response = await GET(
      request('client-1', 'https://client.example/callback'),
    )

    expect(response.status).toBe(401)
  })
})
