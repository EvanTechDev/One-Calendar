import { expect, it, vi } from 'vitest'
import { betterAuth } from 'better-auth'
import { memoryAdapter } from '@better-auth/memory-adapter'
import { createMcpOAuthPlugins } from '@zntr/auth/server'
import { authSchema } from '@zntr/auth/schema'

const mock = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('@zntr/auth/cimd-fetch', () => ({ fetchCimdResource: mock.fetch }))

it.each([
  { homepage: 'https://mira.top', logout: undefined, allowed: true },
  {
    homepage: 'https://mira.top',
    logout: ['https://other.example/logout'],
    allowed: false,
  },
  { homepage: 'http://127.0.0.1/private', logout: undefined, allowed: false },
])(
  'validates CIMD homepage $homepage and logout $logout',
  async ({ homepage, logout, allowed }) => {
    const clientId = 'https://api.mira.top/oauth/client.json'
    mock.fetch.mockResolvedValue(
      Response.json({
        client_id: clientId,
        client_name: 'Mira',
        client_uri: homepage,
        redirect_uris: ['https://mira.top/callback'],
        ...(logout ? { post_logout_redirect_uris: logout } : {}),
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code'],
        response_types: ['code'],
      }),
    )
    const auth = betterAuth({
      baseURL: 'https://calendar.example',
      secret: 'test-secret-long-enough-for-cimd-validation',
      database: memoryAdapter(
        Object.fromEntries(Object.keys(authSchema).map((model) => [model, []])),
      ),
      plugins: createMcpOAuthPlugins({
        resource: 'https://calendar.example/api/mcp',
        loginPage: '/oauth/sign-in',
        consentPage: '/oauth/consent',
        verificationUri: '/oauth/device',
        scopes: ['events:read'],
      }),
    })
    const url = new URL('https://calendar.example/api/auth/oauth2/authorize')
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: 'https://mira.top/callback',
      scope: 'events:read',
      state: 'state',
      code_challenge: 'a'.repeat(43),
      code_challenge_method: 'S256',
      resource: 'https://calendar.example/api/mcp',
    }).toString()
    const response = await auth.handler(new Request(url))
    if (allowed) {
      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toContain('/oauth/sign-in')
    } else {
      const body = await response.json()
      expect(body.error).toBe('invalid_client')
    }
  },
)
