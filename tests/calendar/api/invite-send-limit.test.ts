import { mock as moduleMock } from 'bun:test'
import { beforeEach, expect, it, vi } from 'bun:test'
import { NextRequest } from 'next/server'
import { getFakeDb } from './route-test-db'

const state = (() => ({ authenticated: true, remaining: 1 }))()
const nativeOriginal1 = { ...(await import('drizzle-orm')) }
moduleMock.module('drizzle-orm', async () => ({
  ...nativeOriginal1,
  ...(await import('./route-test-db')).drizzleOperatorsMock,
}))
moduleMock.module('@/lib/drizzle/client', () => ({
  getDb: () => getFakeDb().db,
}))
moduleMock.module('@/lib/api-helpers', () => ({
  getAuthedUser: async () => (state.authenticated ? { id: 'owner' } : null),
}))
const originalFieldCrypto = { ...(await import('@/lib/field-crypto')) }
moduleMock.module('@/lib/field-crypto', () => ({
  ...originalFieldCrypto,
  decryptField: (_id: string, v: unknown) => v,
}))
moduleMock.module('@/features/invites/meeting-link', () => ({
  resolveMeetingUrl: async () => null,
}))
const originalInviteService = {
  ...(await import('@/features/invites/invite-service')),
}
moduleMock.module('@/features/invites/invite-service', () => ({
  ...originalInviteService,
  resendInviteEmail: vi.fn(async () => true),
}))
moduleMock.module('@/lib/rate-limit', () => ({
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
const { POST: resend } = await import('@/app/api/invites/manage/route')

const { POST: send } = await import('@/app/api/invites/route')

const { resendInviteEmail } = await import('@/features/invites/invite-service')

const { checkFixedWindowLimit } = await import('@/lib/rate-limit')

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
  for (const [input] of checkFixedWindowLimit.mock.calls) {
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
