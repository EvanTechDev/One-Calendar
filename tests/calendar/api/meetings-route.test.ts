import { describe, it, expect, beforeEach, vi } from 'vitest'
import { drizzleOperatorsMock, getFakeDb } from './route-test-db'

const OWNER = 'user-owner'
const STRANGER = 'user-stranger'

let authedUser: { id: string } | null = { id: OWNER }

vi.mock('drizzle-orm', async () => {
  const actual =
    await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm')
  return { ...actual, ...drizzleOperatorsMock }
})

vi.mock('@/lib/drizzle/client', () => ({
  getDb: () => getFakeDb().db,
}))

vi.mock('@/lib/api-helpers', () => ({
  getAuthedUser: async () => authedUser,
}))

vi.mock('@/lib/meetings', () => ({
  meetingUrl: (id: string) => `https://meet.test/${id}`,
}))

// The package's operations are exercised against the fake db through these
// thin wrappers, so the route's ownership and idempotency logic is what the
// test observes.
const meetings = new Map<string, { id: string; eventId: string | null }>()
vi.mock('@zntr/meetings', () => ({
  generateMeetingId: () => `code-${meetings.size + 1}`,
  getMeeting: async (_db: unknown, id: string) => meetings.get(id) ?? null,
  getMeetingForEvent: async (_db: unknown, eventId: string) =>
    [...meetings.values()].find((m) => m.eventId === eventId) ?? null,
  createMeeting: async (
    _db: unknown,
    input: { id: string; eventId?: string | null },
  ) => {
    const row = { id: input.id, eventId: input.eventId ?? null }
    meetings.set(row.id, row)
    return row
  },
  deleteMeetingsForEvent: async (_db: unknown, eventId: string) => {
    for (const [id, row] of meetings) {
      if (row.eventId === eventId) meetings.delete(id)
    }
  },
}))

const { GET, POST, DELETE } = await import('@/app/api/meetings/route')

function req(body?: unknown, url = 'https://cal.test/api/meetings') {
  return {
    url,
    json: async () => {
      if (body === undefined) throw new Error('no body')
      return body
    },
  } as never
}

describe('calendar meetings route', () => {
  beforeEach(() => {
    meetings.clear()
    authedUser = { id: OWNER }
    const db = getFakeDb()
    db.reset()
    for (const row of [
      { id: 'evt-1', userId: OWNER, seriesId: null },
      { id: 'evt-master', userId: OWNER, seriesId: null },
      { id: 'evt-occurrence', userId: OWNER, seriesId: 'evt-master' },
      { id: 'evt-foreign', userId: STRANGER, seriesId: null },
    ]) {
      db.seed(row, 'calendar_events')
    }
  })

  it('rejects unauthenticated callers', async () => {
    authedUser = null
    const response = await POST(req({ eventId: 'evt-1' }))
    expect(response.status).toBe(401)
  })

  it('refuses to attach a meeting to somebody else’s event', async () => {
    const response = await POST(req({ eventId: 'evt-foreign' }))
    expect(response.status).toBe(404)
    expect(meetings.size).toBe(0)
  })

  it('attaches a meeting and returns its link', async () => {
    const response = await POST(req({ eventId: 'evt-1' }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.meeting.id).toBe('code-1')
    expect(body.meeting.url).toBe('https://meet.test/code-1')
  })

  it('is idempotent: a second attach reuses the same room', async () => {
    const first = await (await POST(req({ eventId: 'evt-1' }))).json()
    const second = await (await POST(req({ eventId: 'evt-1' }))).json()
    expect(second.meeting.id).toBe(first.meeting.id)
    expect(meetings.size).toBe(1)
  })

  it('attaches a series meeting to the master, from any occurrence', async () => {
    await POST(req({ eventId: 'evt-occurrence' }))
    const [row] = [...meetings.values()]
    expect(row.eventId).toBe('evt-master')
  })

  it('resolves an existing meeting through GET', async () => {
    await POST(req({ eventId: 'evt-1' }))
    const response = await GET(
      req(undefined, 'https://cal.test/api/meetings?eventId=evt-1'),
    )
    const body = await response.json()
    expect(body.meeting.id).toBe('code-1')
  })

  it('reports no meeting when none is attached', async () => {
    const response = await GET(
      req(undefined, 'https://cal.test/api/meetings?eventId=evt-1'),
    )
    expect((await response.json()).meeting).toBeNull()
  })

  it('detaches a meeting', async () => {
    await POST(req({ eventId: 'evt-1' }))
    const response = await DELETE(req({ eventId: 'evt-1' }))
    expect(response.status).toBe(200)
    expect(meetings.size).toBe(0)
  })

  it('refuses to detach from a foreign event', async () => {
    await POST(req({ eventId: 'evt-1' }))
    authedUser = { id: STRANGER }
    const response = await DELETE(req({ eventId: 'evt-1' }))
    expect(response.status).toBe(404)
    expect(meetings.size).toBe(1)
  })
})
