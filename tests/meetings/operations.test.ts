/**
 * Meeting lifecycle operations and the cascades that keep rows from being
 * orphaned.
 *
 * Pinned here:
 *
 * - SEC-06: room codes were generated with `bytes[i] % 36`, which biases the
 *   first four symbols of the alphabet by about 14%. The code IS the join
 *   credential (holding the link is sufficient to join, ADR 0019), so that is
 *   lost entropy in a credential.
 * - SEC-03: account deletion never touched meetings, leaving never-expiring
 *   joinable rooms whose organiser no longer exists — rooms NOBODY can end,
 *   because isOrganiser needs either that user's session or a Creator Token
 *   (null for signed-in organisers).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  createMeeting,
  deleteMeetingsForEvent,
  deleteMeetingsForEvents,
  deleteMeetingsForOrganiser,
  generateCreatorToken,
  generateMeetingId,
  getMeeting,
  getMeetingForEvent,
  hashCreatorToken,
  isJoinable,
  meeting,
  moveMeetingToEvent,
  verifyCreatorToken,
} from '@zntr/meetings'
import { createFakeDb } from './fake-db'

const fake = createFakeDb()
const db = fake.db
const OWNER = 'user-1'
const OTHER = 'user-2'

beforeEach(() => {
  fake.reset()
})

describe('generateMeetingId (SEC-06)', () => {
  it('always produces the xxxx-xxxx shape', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateMeetingId()).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}$/)
    }
  })

  it('draws symbols close to uniformly, not biased toward the first four', () => {
    // `% 36` over a byte maps 0–3 from eight source values and 4–35 from seven,
    // a ~14% excess. Rejection sampling removes it. 36 symbols over 40k draws
    // gives ~1111 expected each; a 14% bias is ~1270 and well outside this band.
    const counts = new Map<string, number>()
    const draws = 5000
    for (let i = 0; i < draws; i++) {
      for (const char of generateMeetingId().replace('-', '')) {
        counts.set(char, (counts.get(char) ?? 0) + 1)
      }
    }
    const total = draws * 8
    const expected = total / 36
    expect(counts.size).toBe(36)
    for (const [, count] of counts) {
      // Generous band: this must fail on systematic bias, not on noise.
      expect(count).toBeGreaterThan(expected * 0.85)
      expect(count).toBeLessThan(expected * 1.15)
    }
  })

  it('does not repeat itself in practice', () => {
    const ids = new Set(Array.from({ length: 500 }, generateMeetingId))
    expect(ids.size).toBeGreaterThan(490)
  })
})

describe('creator tokens', () => {
  it('verifies a token against its own hash and rejects others', () => {
    const token = generateCreatorToken()
    const hash = hashCreatorToken(token)
    expect(verifyCreatorToken(token, hash)).toBe(true)
    expect(verifyCreatorToken(generateCreatorToken(), hash)).toBe(false)
  })

  it('is false for missing values rather than throwing', () => {
    expect(verifyCreatorToken(null, null)).toBe(false)
    expect(verifyCreatorToken('x', null)).toBe(false)
    expect(verifyCreatorToken(null, hashCreatorToken('x'))).toBe(false)
    expect(verifyCreatorToken('', '')).toBe(false)
  })

  it('is false for a malformed stored hash of the wrong length', () => {
    expect(verifyCreatorToken('x', 'abcd')).toBe(false)
  })
})

describe('isJoinable', () => {
  const now = new Date('2026-03-01T12:00:00Z')
  const base = {
    id: 'abcd-0001',
    organiserId: OWNER,
    creatorTokenHash: null,
    eventId: null,
    accessPolicy: 'open',
    endedAt: null,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
  }

  it('accepts an open, unexpired meeting', () => {
    expect(isJoinable(base as never, now)).toBe(true)
  })

  it('refuses an ended meeting', () => {
    expect(isJoinable({ ...base, endedAt: now } as never, now)).toBe(false)
  })

  it('refuses an expired one, at the boundary too', () => {
    expect(isJoinable({ ...base, expiresAt: now } as never, now)).toBe(false)
    expect(
      isJoinable(
        { ...base, expiresAt: new Date('2026-03-01T12:00:01Z') } as never,
        now,
      ),
    ).toBe(true)
  })
})

describe('event cascades (ADR 0017 — application-level, no FK)', () => {
  beforeEach(async () => {
    await createMeeting(db, {
      id: 'aaaa-0001',
      organiserId: OWNER,
      eventId: 'evt-1',
    })
    await createMeeting(db, {
      id: 'bbbb-0002',
      organiserId: OWNER,
      eventId: 'evt-2',
    })
    await createMeeting(db, {
      id: 'cccc-0003',
      organiserId: OTHER,
      eventId: 'evt-3',
    })
    await createMeeting(db, {
      id: 'dddd-0004',
      organiserId: OWNER,
      eventId: null,
    })
  })

  it('deletes the meeting for one event', async () => {
    await deleteMeetingsForEvent(db, 'evt-1')
    expect(await getMeetingForEvent(db, 'evt-1')).toBeNull()
    expect(await getMeetingForEvent(db, 'evt-2')).not.toBeNull()
  })

  it('deletes for many events in one call', async () => {
    // A series delete used to issue one statement per row id, 51 for a
    // 50-override series, though only masters ever carry a meeting.
    await deleteMeetingsForEvents(db, ['evt-1', 'evt-2', 'evt-missing'])
    expect(await getMeetingForEvent(db, 'evt-1')).toBeNull()
    expect(await getMeetingForEvent(db, 'evt-2')).toBeNull()
    expect(await getMeetingForEvent(db, 'evt-3')).not.toBeNull()
  })

  it('is a no-op for an empty id list rather than deleting everything', async () => {
    await deleteMeetingsForEvents(db, [])
    expect(fake.all(meeting)).toHaveLength(4)
  })

  it('re-points a meeting at a new master across a series split', async () => {
    await moveMeetingToEvent(db, 'evt-1', 'evt-1-tail')
    expect(await getMeetingForEvent(db, 'evt-1')).toBeNull()
    expect((await getMeetingForEvent(db, 'evt-1-tail'))?.id).toBe('aaaa-0001')
  })
})

describe('deleteMeetingsForOrganiser (SEC-03)', () => {
  it('removes every meeting the departing user organised, and only theirs', async () => {
    await createMeeting(db, { id: 'aaaa-0001', organiserId: OWNER })
    await createMeeting(db, {
      id: 'bbbb-0002',
      organiserId: OWNER,
      eventId: 'evt-1',
    })
    await createMeeting(db, { id: 'cccc-0003', organiserId: OTHER })
    // A guest meeting has no organiser id and must not be swept up.
    await createMeeting(db, {
      id: 'dddd-0004',
      creatorTokenHash: hashCreatorToken('secret'),
    })

    await deleteMeetingsForOrganiser(db, OWNER)

    expect(await getMeeting(db, 'aaaa-0001')).toBeNull()
    expect(await getMeeting(db, 'bbbb-0002')).toBeNull()
    expect(await getMeeting(db, 'cccc-0003')).not.toBeNull()
    expect(await getMeeting(db, 'dddd-0004')).not.toBeNull()
  })
})
