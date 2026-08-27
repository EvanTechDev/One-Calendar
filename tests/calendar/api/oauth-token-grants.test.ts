// @vitest-environment node
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { drizzleOperatorsMock, getFakeDb } from './route-test-db'

vi.mock('drizzle-orm', async () => {
  const actual =
    await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm')
  return { ...actual, ...drizzleOperatorsMock }
})

vi.mock('@/lib/drizzle/client', () => ({
  getDb: async () => getFakeDb().db,
}))

vi.mock('@/lib/mcp/auth', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/mcp/auth')>('@/lib/mcp/auth')
  let sequence = 0
  return {
    ...actual,
    generateAccessToken: () => `access-${++sequence}`,
    generateRefreshToken: () => `refresh-${sequence}`,
    getUserNameAndEmail: async () => ({
      name: 'Ada',
      email: 'ada@example.com',
    }),
  }
})

const { POST } = await import('@/app/api/oauth/token/route')
const { generateCodeChallenge, hashAuthorizationCode, hashToken } =
  await import('@/lib/mcp/auth')

function post(body: unknown, authorization?: string) {
  return POST(
    new NextRequest('https://calendar.example/api/oauth/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(authorization ? { authorization } : {}),
      },
      body: JSON.stringify(body),
    }),
  )
}

function seedClient(
  id: string,
  options: { secret?: string; revoked?: boolean } = {},
) {
  getFakeDb().seed(
    {
      id,
      clientSecretHash: options.secret
        ? bcrypt.hashSync(options.secret, 4)
        : null,
      isRevoked: options.revoked ?? false,
    },
    'mcp_oauth_clients',
  )
}

function seedDevice(clientId = 'public-client') {
  getFakeDb().seed(
    {
      id: 'device-row',
      deviceCode: hashToken('device-code'),
      userCode: hashToken('user-code'),
      clientId,
      clientName: 'Device client',
      scopes: ['events:read'],
      status: 'approved',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 60_000),
    },
    'mcp_device_codes',
  )
}

beforeEach(() => {
  getFakeDb().reset()
})

describe('OAuth token grants', () => {
  it('allows a public client and consumes a device code once', async () => {
    seedClient('public-client')
    seedDevice()

    const first = await post({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: 'device-code',
      client_id: 'public-client',
    })
    const second = await post({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: 'device-code',
      client_id: 'public-client',
    })

    expect(first.status).toBe(200)
    expect(await first.json()).toMatchObject({
      token_type: 'bearer',
      scope: 'events:read',
    })
    expect(second.status).toBe(400)
    expect(await second.json()).toMatchObject({ error: 'invalid_grant' })
    expect(getFakeDb().rows('mcp_tokens')).toHaveLength(1)
  })

  it('rejects a confidential device client without its secret', async () => {
    seedClient('confidential-client', { secret: 'correct-secret' })
    seedDevice('confidential-client')

    const response = await post({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: 'device-code',
      client_id: 'confidential-client',
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'invalid_client' })
    expect(getFakeDb().rows('mcp_tokens')).toHaveLength(0)
  })

  it('validates both Basic client identifier and secret', async () => {
    seedClient('confidential-client', { secret: 'correct-secret' })
    seedDevice('confidential-client')
    const wrongId = Buffer.from('other-client:correct-secret').toString(
      'base64',
    )

    const response = await post(
      {
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: 'device-code',
      },
      `Basic ${wrongId}`,
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'invalid_client' })
  })

  it('rotates a refresh token exactly once', async () => {
    seedClient('public-client')
    getFakeDb().seed(
      {
        id: 'old-token',
        userId: 'user-1',
        refreshTokenHash: hashToken('old-refresh'),
        isRevoked: false,
        refreshExpiresAt: new Date(Date.now() + 60_000),
        scopes: ['events:read'],
        clientId: 'public-client',
        clientName: 'Public client',
      },
      'mcp_tokens',
    )

    const request = {
      grant_type: 'refresh_token',
      refresh_token: 'old-refresh',
      client_id: 'public-client',
    }
    const first = await post(request)
    const second = await post(request)

    expect(first.status).toBe(200)
    expect(second.status).toBe(400)
    expect(getFakeDb().rows('mcp_tokens')).toHaveLength(2)
  })

  it('keeps authorization-code PKCE behavior and consumes the code once', async () => {
    seedClient('public-client')
    const verifier = 'verifier-with-enough-entropy-for-this-test'
    getFakeDb().seed(
      {
        id: 'auth-row',
        userId: 'user-1',
        clientId: 'public-client',
        redirectUri: 'https://client.example/callback',
        scopes: ['events:read'],
        codeChallenge: generateCodeChallenge(verifier, 'S256'),
        codeChallengeMethod: 'S256',
        authorizationCode: hashAuthorizationCode('authorization-code'),
        codeExpiresAt: new Date(Date.now() + 60_000),
        status: 'approved',
      },
      'mcp_auth_requests',
    )
    const request = {
      grant_type: 'authorization_code',
      code: 'authorization-code',
      code_verifier: verifier,
      redirect_uri: 'https://client.example/callback',
      client_id: 'public-client',
    }

    const first = await post(request)
    const second = await post(request)

    expect(first.status).toBe(200)
    expect(second.status).toBe(400)
    expect(getFakeDb().rows('mcp_tokens')).toHaveLength(1)
  })

  it('rejects a conflicting submitted client id', async () => {
    seedClient('public-client')
    seedClient('other-client')
    seedDevice()

    const response = await post({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: 'device-code',
      client_id: 'other-client',
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'invalid_client' })
  })

  it('returns invalid_request for malformed runtime field types', async () => {
    const response = await post({
      grant_type: 'refresh_token',
      refresh_token: { nested: 'not a string' },
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'invalid_request',
      error_description: 'Malformed token request',
    })
  })
})
