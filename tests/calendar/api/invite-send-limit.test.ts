// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getFakeDb } from './route-test-db'

const state = vi.hoisted(() => ({ authenticated: true, remaining: 1 }))
vi.mock('drizzle-orm', async (original) => ({
  ...(await original<typeof import('drizzle-orm')>()),
  ...(await import('./route-test-db')).drizzleOperatorsMock,
}))
vi.mock('@/lib/drizzle/client', () => ({ getDb: () => getFakeDb().db }))
vi.mock('@/lib/api-helpers', () => ({
  getAuthedUser: async () => (state.authenticated ? { id: 'owner' } : null),
}))
vi.mock('@/lib/field-crypto', () => ({
  decryptField: (_id: string, v: unknown) => v,
}))
vi.mock('@/lib/invites/meeting-link', () => ({
  resolveMeetingUrl: async () => null,
}))
vi.mock('@/lib/invites/invite-service', () => ({
  resendInviteEmail: vi.fn(async () => true),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkFixedWindowLimit: vi.fn(async () => ({
    allowed: state.remaining-- > 0,
    retryAfter: 60,
  })),
  rateLimitedResponse: (seconds: number) =>
    new Response(null, {
      status: 429,
      headers: { 'Retry-After': String(seconds) },
    }),
}))
import { POST as resend } from '@/app/api/invites/manage/route'
import { POST as send } from '@/app/api/invites/route'
import { resendInviteEmail } from '@/lib/invites/invite-service'
import { checkFixedWindowLimit } from '@/lib/rate-limit'
const fake = getFakeDb()
const request = () =>
  new NextRequest('http://localhost/api/invites/manage', {
    method: 'POST',
    body: JSON.stringify({ inviteId: 'invite' }),
  })
beforeEach(() => {
  fake.reset()
  vi.clearAllMocks()
  state.authenticated = true
  state.remaining = 1
  fake.seed({
    id: 'event',
    userId: 'owner',
    title: 'Sync',
    startDate: new Date(),
    endDate: new Date(),
  })
  fake.seed(
    { id: 'invite', eventId: 'event', email: 'guest@example.com' },
    'event_invites',
  )
})

it('shares the send budget with resends and returns Retry-After before sending', async () => {
  expect((await resend(request())).status).toBe(200)
  expect((await send(request())).status).toBe(429)
  const blocked = await resend(request())
  expect(blocked.status).toBe(429)
  expect(blocked.headers.get('Retry-After')).toBe('60')
  expect(resendInviteEmail).toHaveBeenCalledTimes(1)
  for (const [input] of vi.mocked(checkFixedWindowLimit).mock.calls) {
    expect(input).toEqual({
      name: 'invite-send',
      subject: 'owner',
      limit: 50,
      windowSeconds: 3600,
    })
  }
})

it('requires authentication before consuming the send budget', async () => {
  state.authenticated = false
  expect((await resend(request())).status).toBe(401)
  expect(checkFixedWindowLimit).not.toHaveBeenCalled()
  expect(resendInviteEmail).not.toHaveBeenCalled()
})
