// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  session: null as { user: { id: string; email: string } } | null,
}))

vi.mock('@/lib/auth/server', () => ({
  getServerSession: async () => state.session,
}))

const { GET } = await import('@/app/api/diagnostics/meet/route')

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('NEXT_PUBLIC_MEET_ORIGIN', 'https://meet.example.com')
  vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://calendar.example.com')
  vi.stubEnv('AUTH_COOKIE_DOMAIN', '.example.com')
  vi.stubEnv('BETTER_AUTH_SECRET', 'present-not-returned')
  vi.stubEnv('SALT', 'present-not-returned')
  state.session = null
})

afterEach(() => vi.unstubAllEnvs())

describe('calendar meet diagnostics in production', () => {
  it('returns 404 to an anonymous caller', async () => {
    const response = await GET()

    expect(response.status).toBe(404)
  })

  it('returns only sanitized readiness to an authenticated caller', async () => {
    state.session = { user: { id: 'user-1', email: 'private@example.com' } }
    const response = await GET()
    const body = await response.json()
    const serialized = JSON.stringify(body)

    expect(response.status).toBe(200)
    expect(body).toEqual({
      ready: true,
      checks: expect.any(Object),
      remediation: [],
    })
    expect(serialized).not.toContain('private@example.com')
    expect(serialized).not.toContain('present-not-returned')
    expect(body).not.toHaveProperty('config')
  })
})
