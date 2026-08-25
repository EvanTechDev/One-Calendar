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
type FakeMeeting = {
  id: string
  eventId: string | null
  organiserId: string | null
  /** Non-null marks the row provisional — the event does not exist yet. */
  expiresAt: Date | null
}
const meetings = new Map<string, FakeMeeting>()
let created = 0
vi.mock('@zntr/meetings', () => ({
  generateMeetingId: () => `code-${created + 1}`,
  getMeeting: async (_db: unknown, id: string) => meetings.get(id) ?? null,
  getMeetingForEvent: async (_db: unknown, eventId: string) =>
    [...meetings.values()].find((m) => m.eventId === eventId) ?? null,
  createMeeting: async (
    _db: unknown,
    input: {
      id: string
      eventId?: string | null
      organiserId?: string | null
      expiresAt?: Date | null
    },
  ) => {
    created += 1
    const row: FakeMeeting = {
      id: input.id,
      eventId: input.eventId ?? null,
      organiserId: input.organiserId ?? null,
      expiresAt: input.expiresAt ?? null,
    }
    meetings.set(row.id, row)
    return row
  },
  deleteMeetingsForEvent: async (_db: unknown, eventId: string) => {
    for (const [id, row] of meetings) {
      if (row.eventId === eventId) meetings.delete(id)
    }
  },
  // Mirrors the real operation's SQL predicates, which are what actually
  // enforce these rules — see tests/meetings/provisional-meetings.test.ts.
  deleteProvisionalMeetingForEvent: async (
    _db: unknown,
    eventId: string,
    organiserId: string,
  ) => {
    const removed: string[] = []
    for (const [id, row] of meetings) {
      if (
        row.eventId === eventId &&
        row.organiserId === organiserId &&
        row.expiresAt !== null
      ) {
        meetings.delete(id)
        removed.push(id)
      }
    }
    return removed
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  checkFixedWindowLimit: async () => ({
    allowed: rateLimitAllows,
    retryAfter: 60,
  }),
  rateLimitedResponse: (retryAfter: number) =>
    Response.json({ error: 'Too many requests', retryAfter }, { status: 429 }),
}))

let rateLimitAllows = true

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
    created = 0
    rateLimitAllows = true
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

/**
 * "Add Zentra Meet" creates the room immediately, so the route must accept an
 * event id that has no row yet — and must keep that row distinguishable from a
 * committed Event Meeting, because the editor-close cleanup is allowed to delete
 * one and never the other.
 */
describe('provisional meetings for unsaved events', () => {
  beforeEach(() => {
    meetings.clear()
    created = 0
    rateLimitAllows = true
    authedUser = { id: OWNER }
    const db = getFakeDb()
    db.reset()
    db.seed({ id: 'evt-1', userId: OWNER, seriesId: null }, 'calendar_events')
    db.seed(
      { id: 'evt-foreign', userId: STRANGER, seriesId: null },
      'calendar_events',
    )
  })

  it('creates a room for an event that does not exist yet', async () => {
    const response = await POST(req({ eventId: 'draft-1', provisional: true }))
    expect(response.status).toBe(200)
    const row = meetings.get('code-1')!
    expect(row.eventId).toBe('draft-1')
    // The expiry is what hands the abandoned-tab case to the ADR-0018 sweep.
    expect(row.expiresAt).toBeInstanceOf(Date)
    expect(row.expiresAt!.getTime()).toBeGreaterThan(Date.now())
  })

  it('still 404s for a missing event when provisional is not asked for', async () => {
    const response = await POST(req({ eventId: 'draft-1' }))
    expect(response.status).toBe(404)
    expect(meetings.size).toBe(0)
  })

  it('creates a COMMITTED room when the event already exists', async () => {
    await POST(req({ eventId: 'evt-1', provisional: false }))
    // No expiry: an Event Meeting's lifecycle is its event's (ADR-0018).
    expect(meetings.get('code-1')!.expiresAt).toBeNull()
  })

  it('does not let provisional smuggle a room onto a foreign event', async () => {
    const response = await POST(
      req({ eventId: 'evt-foreign', provisional: true }),
    )
    // The row exists and belongs to somebody else, so ownership decides — the
    // provisional flag only excuses a MISSING row.
    expect(response.status).toBe(404)
    expect(meetings.size).toBe(0)
  })

  it('rate-limits provisional creation', async () => {
    // Provisional creation accepts ids no row exists for, so event ownership
    // cannot bound how many rooms one account mints.
    rateLimitAllows = false
    const response = await POST(req({ eventId: 'draft-1', provisional: true }))
    expect(response.status).toBe(429)
    expect(meetings.size).toBe(0)
  })

  it('is idempotent for a draft: add → close → add mints no second room', async () => {
    const first = await (
      await POST(req({ eventId: 'draft-1', provisional: true }))
    ).json()
    const second = await (
      await POST(req({ eventId: 'draft-1', provisional: true }))
    ).json()
    expect(second.meeting.id).toBe(first.meeting.id)
    expect(meetings.size).toBe(1)
  })

  it('deletes a provisional room on editor close', async () => {
    await POST(req({ eventId: 'draft-1', provisional: true }))
    const response = await DELETE(
      req({ eventId: 'draft-1', provisional: true }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ removed: 1 })
    expect(meetings.size).toBe(0)
  })

  it('REFUSES to delete a committed meeting on editor close', async () => {
    // The data-loss guard. An existing event's saved meeting must survive the
    // editor being dismissed, whatever the client claims.
    await POST(req({ eventId: 'evt-1', provisional: false }))
    const response = await DELETE(req({ eventId: 'evt-1', provisional: true }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ removed: 0 })
    expect(meetings.size).toBe(1)
  })

  it('refuses another user\u2019s provisional room', async () => {
    await POST(req({ eventId: 'draft-1', provisional: true }))
    authedUser = { id: STRANGER }
    const response = await DELETE(
      req({ eventId: 'draft-1', provisional: true }),
    )
    expect(response.status).toBe(200)
    expect(meetings.size).toBe(1)
  })

  it('tolerates a close cleanup for a draft that never had a room', async () => {
    const response = await DELETE(
      req({ eventId: 'draft-nothing', provisional: true }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ removed: 0 })
  })
})
