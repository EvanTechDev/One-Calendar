// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { drizzleOperatorsMock, getFakeDb } from './route-test-db'

const state = vi.hoisted(() => ({
  currentUser: null as { id: string; email: string } | null,
  invite: {
    id: 'invite-1',
    eventId: 'event-1',
    email: 'invitee@example.com',
    status: 'pending',
    addedToCalendar: false,
    expiresAt: null,
    baselineKind: 'all',
    fromStamp: null,
    untilStamp: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  },
  addCalls: [] as Array<{ token: string; categoryId: string | null }>,
}))

vi.mock('drizzle-orm', async () => {
  const actual =
    await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm')
  return { ...actual, ...drizzleOperatorsMock }
})

vi.mock('@/lib/drizzle/client', () => ({
  getDb: () => getFakeDb().db,
}))

vi.mock('@/lib/api-helpers', () => ({
  getAuthedUser: async () => state.currentUser,
}))

vi.mock('@/lib/invites/invite-service', () => ({
  getInvitesByToken: async () => [state.invite],
  getInviteByToken: async () => state.invite,
  getInviteOccurrences: async () => [],
  baselineOf: () => ({
    baselineKind: 'all',
    fromStamp: null,
    untilStamp: null,
  }),
  updateRsvp: vi.fn(),
  updateOccurrenceRsvp: vi.fn(),
  removeParticipantFromCalendar: vi.fn(),
  addParticipantToCalendar: async (token: string, categoryId: string | null) =>
    state.addCalls.push({ token, categoryId }),
}))

vi.mock('@zntr/meetings', () => ({ getMeetingForEvent: async () => null }))
vi.mock('@/lib/field-crypto', () => ({
  decryptField: (_id: string, value: unknown) => value,
}))
vi.mock('@/lib/rate-limit', () => ({
  checkFixedWindowLimit: async () => ({ allowed: true, retryAfter: 0 }),
  clientIpFrom: () => '203.0.113.10',
  rateLimitedResponse: () => new Response(null, { status: 429 }),
}))

const { GET, PATCH } = await import('@/app/api/invite/[token]/route')

function context() {
  return { params: Promise.resolve({ token: 'raw-invite-token' }) }
}

async function getInvite() {
  return GET(
    new NextRequest('https://calendar.example/api/invite/raw-invite-token'),
    context(),
  )
}

async function patchInvite(body: Record<string, unknown>) {
  return PATCH(
    new NextRequest('https://calendar.example/api/invite/raw-invite-token', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    context(),
  )
}

beforeEach(() => {
  getFakeDb().reset()
  state.currentUser = null
  state.addCalls.length = 0
  getFakeDb().seed(
    {
      id: 'event-1',
      userId: 'owner-1',
      title: 'Private planning',
      description: null,
      location: null,
      startDate: new Date('2026-09-01T10:00:00Z'),
      endDate: new Date('2026-09-01T11:00:00Z'),
      isAllDay: false,
      color: null,
      rrule: null,
      seriesId: null,
    },
    'calendar_events',
  )
  getFakeDb().seed({ id: 'owner-1', name: 'Owner', image: null }, 'user')
  getFakeDb().seed(
    {
      id: 'private-category',
      userId: 'invitee-user',
      name: 'Private category',
      color: '#112233',
      sortOrder: 0,
    },
    'calendar_categories',
  )
})

describe('invite category privacy', () => {
  it('does not disclose categories to an anonymous token holder', async () => {
    const response = await getInvite()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.categories).toEqual([])
    expect(body.isRegisteredUser).toBe(false)
  })

  it('does not disclose categories to the wrong signed-in account', async () => {
    state.currentUser = { id: 'other-user', email: 'other@example.com' }
    const body = await (await getInvite()).json()

    expect(body.categories).toEqual([])
    expect(body.isRegisteredUser).toBe(false)
  })

  it('returns categories only to the matching participant', async () => {
    state.currentUser = {
      id: 'invitee-user',
      email: 'INVITEE@example.com',
    }
    const body = await (await getInvite()).json()

    expect(body.isRegisteredUser).toBe(true)
    expect(body.categories).toEqual([
      { id: 'private-category', name: 'Private category', color: '#112233' },
    ])
  })

  it('rejects anonymous category selection, including uncategorized', async () => {
    const response = await patchInvite({ categoryId: '__uncategorized__' })

    expect(response.status).toBe(401)
    expect(state.addCalls).toHaveLength(0)
  })

  it('allows the matching participant to select their category', async () => {
    state.currentUser = {
      id: 'invitee-user',
      email: 'invitee@example.com',
    }
    const response = await patchInvite({ categoryId: 'private-category' })

    expect(response.status).toBe(200)
    expect(state.addCalls).toEqual([
      { token: 'raw-invite-token', categoryId: 'private-category' },
    ])
  })

  it('rejects a category owned by another user', async () => {
    state.currentUser = {
      id: 'other-user',
      email: 'invitee@example.com',
    }
    const response = await patchInvite({ categoryId: 'private-category' })

    expect(response.status).toBe(404)
    expect(state.addCalls).toHaveLength(0)
  })
})
