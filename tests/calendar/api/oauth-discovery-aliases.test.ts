// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

const metadata = vi.hoisted(() =>
  vi.fn(() => Response.json({ issuer: 'https://calendar.example/api/auth' })),
)

vi.mock('@zntr/auth/server', () => ({
  oauthProviderAuthServerMetadata: () => metadata,
}))
vi.mock('@/lib/auth', () => ({ auth: {} }))

const root = await import('@/app/.well-known/oauth-authorization-server/route')
const issuerPath =
  await import('@/app/.well-known/oauth-authorization-server/api/auth/route')

describe('OAuth authorization server discovery aliases', () => {
  it('serves identical metadata at the root and issuer-path alias', async () => {
    const request = new Request(
      'https://calendar.example/.well-known/oauth-authorization-server',
    )
    const rootResponse = await root.GET(request)
    const aliasResponse = await issuerPath.GET(request)

    expect(await rootResponse.json()).toEqual(await aliasResponse.json())
    expect(metadata).toHaveBeenCalledTimes(2)
  })
})
