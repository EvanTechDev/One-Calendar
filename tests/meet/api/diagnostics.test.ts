// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  session: null as { user: { id: string; email: string } } | null,
  databaseError: null as Error | null,
}))

vi.mock('@/lib/auth/server', () => ({
  getServerSession: async () => state.session,
}))

vi.mock('@/lib/drizzle', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        limit: async () => {
          if (state.databaseError) throw state.databaseError
          return [{ ok: 1 }]
        },
      }),
    }),
  }),
}))

vi.mock('@zntr/meetings', () => ({ meeting: {} }))

const { GET } = await import('@/app/api/diagnostics/route')

function request() {
  return {
    headers: new Headers({
      host: 'meet.example.com',
      cookie: 'better-auth.session_token=private-cookie-value',
    }),
  } as never
}

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('NEXT_PUBLIC_CALENDAR_ORIGIN', 'https://calendar.example.com')
  vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://meet.example.com')
  vi.stubEnv('AUTH_COOKIE_DOMAIN', '.example.com')
  vi.stubEnv('BETTER_AUTH_SECRET', 'present-not-returned')
  vi.stubEnv('POSTGRES_URL', 'postgres://must-not-be-returned')
  vi.stubEnv('SALT', 'present-not-returned')
  vi.stubEnv('LIVEKIT_URL', 'wss://livekit.example.com')
  vi.stubEnv('LIVEKIT_API_KEY', 'present-not-returned')
  vi.stubEnv('LIVEKIT_API_SECRET', 'present-not-returned')
  state.session = null
  state.databaseError = null
})

afterEach(() => vi.unstubAllEnvs())

describe('meet diagnostics in production', () => {
  it('returns 404 before probing configuration for an anonymous caller', async () => {
    const response = await GET(request())

    expect(response.status).toBe(404)
  })

  it('returns sanitized readiness without raw errors or identity', async () => {
    state.session = { user: { id: 'user-1', email: 'private@example.com' } }
    state.databaseError = new Error('raw database host and credential detail')
    const response = await GET(request())
    const body = await response.json()
    const serialized = JSON.stringify(body)

    expect(response.status).toBe(200)
    expect(body.ready).toBe(false)
    expect(body.checks.databaseReachable).toBe(false)
    expect(body.remediation).toContain('check-database')
    expect(serialized).not.toContain('raw database')
    expect(serialized).not.toContain('private@example.com')
    expect(serialized).not.toContain('private-cookie-value')
    expect(serialized).not.toContain('postgres://')
    expect(body).not.toHaveProperty('config')
    expect(body).not.toHaveProperty('request')
  })
})
