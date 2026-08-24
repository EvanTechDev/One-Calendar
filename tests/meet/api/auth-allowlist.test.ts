import { describe, it, expect, vi } from 'vitest'

// The route delegates to Better Auth for allowed paths only. Stub both the
// handler factory and the auth instance so the test observes the allowlist
// decision without touching a database.
const handled = vi.fn(() => new Response('delegated', { status: 200 }))

vi.mock('@zntr/auth', () => ({
  toNextJsHandler: () => ({ GET: handled, POST: handled }),
}))
vi.mock('@/lib/auth', () => ({ getAuth: () => ({}) }))

const { GET, POST } = await import('@/app/api/auth/[...all]/route')

function req(path: string) {
  return new Request(`https://meet.example.com${path}`) as never
}

describe('meet auth surface allowlist', () => {
  it('allows the session read', async () => {
    const response = await GET(req('/api/auth/get-session'))
    expect(response.status).toBe(200)
  })

  it('allows sign-out', async () => {
    const response = await POST(req('/api/auth/sign-out'))
    expect(response.status).toBe(200)
  })

  it('blocks sign-up', async () => {
    const response = await POST(req('/api/auth/sign-up/email'))
    expect(response.status).toBe(404)
  })

  it('blocks sign-in', async () => {
    const response = await POST(req('/api/auth/sign-in/email'))
    expect(response.status).toBe(404)
  })

  it('blocks password reset', async () => {
    const response = await POST(req('/api/auth/forget-password'))
    expect(response.status).toBe(404)
  })

  it('blocks a prefix-extended sign-out path', async () => {
    const response = await POST(req('/api/auth/sign-out/extra'))
    expect(response.status).toBe(404)
  })

  it('blocks the session read over POST', async () => {
    const response = await POST(req('/api/auth/get-session'))
    expect(response.status).toBe(404)
  })
})
