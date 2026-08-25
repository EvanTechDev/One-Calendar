/**
 * Provisional Event Meetings — the rows that exist between "Add Zentra Meet"
 * and the event actually being saved.
 *
 * The organiser gets a copyable link immediately (Google Calendar parity,
 * ADR 0018's standing principle), which means the row outlives the click but
 * may never gain an event. Two properties are load-bearing:
 *
 * - a provisional row carries `expiresAt`, so the existing expired-meeting
 *   sweep (ADR 0018) collects it when no cleanup code ever runs — a killed
 *   tab, a crashed browser;
 * - the fast-path delete refuses to touch a COMMITTED Event Meeting. That is
 *   the data-loss guard: closing the editor on an existing event whose meeting
 *   was saved long ago must not delete the link its participants hold.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  commitMeetingForEvent,
  createMeeting,
  deleteExpiredMeetings,
  deleteProvisionalMeetingForEvent,
  getMeetingForEvent,
  getMeetingsForEvents,
  meeting,
} from '@zntr/meetings'
import { createFakeDb } from './fake-db'

const fake = createFakeDb()
const db = fake.db
const OWNER = 'user-1'
const OTHER = 'user-2'
const HOUR = 60 * 60 * 1000

beforeEach(() => {
  fake.reset()
})

describe('deleteProvisionalMeetingForEvent', () => {
  it('removes a provisional row and reports its id', async () => {
    await createMeeting(db, {
      id: 'aaaa-1111',
      organiserId: OWNER,
      eventId: 'evt-draft',
      expiresAt: new Date(Date.now() + HOUR),
    })

    const removed = await deleteProvisionalMeetingForEvent(
      db,
      'evt-draft',
      OWNER,
    )

    expect(removed).toEqual(['aaaa-1111'])
    expect(await getMeetingForEvent(db, 'evt-draft')).toBeNull()
  })

  it('refuses to delete a committed Event Meeting', async () => {
    // The single most important correctness property: an existing event's
    // already-saved meeting survives an editor close. `expiresAt` null IS what
    // "committed" means, and the predicate is in the statement so no caller can
    // forget to check it.
    await createMeeting(db, {
      id: 'bbbb-2222',
      organiserId: OWNER,
      eventId: 'evt-saved',
      expiresAt: null,
    })

    const removed = await deleteProvisionalMeetingForEvent(
      db,
      'evt-saved',
      OWNER,
    )

    expect(removed).toEqual([])
    expect(await getMeetingForEvent(db, 'evt-saved')).not.toBeNull()
  })

  it('leaves other events alone', async () => {
    await createMeeting(db, {
      id: 'cccc-3333',
      organiserId: OWNER,
      eventId: 'evt-a',
      expiresAt: new Date(Date.now() + HOUR),
    })
    await createMeeting(db, {
      id: 'dddd-4444',
      organiserId: OWNER,
      eventId: 'evt-b',
      expiresAt: new Date(Date.now() + HOUR),
    })

    await deleteProvisionalMeetingForEvent(db, 'evt-a', OWNER)

    expect(await getMeetingForEvent(db, 'evt-b')).not.toBeNull()
    expect(fake.all(meeting)).toHaveLength(1)
  })

  it('is a no-op when the event never had a meeting', async () => {
    expect(
      await deleteProvisionalMeetingForEvent(db, 'evt-none', OWNER),
    ).toEqual([])
  })

  it('refuses another user, even on a provisional row', async () => {
    // Event ids are client-chosen, so event id alone is not an authorisation.
    await createMeeting(db, {
      id: 'aaaa-2020',
      organiserId: OWNER,
      eventId: 'evt-draft',
      expiresAt: new Date(Date.now() + HOUR),
    })

    expect(
      await deleteProvisionalMeetingForEvent(db, 'evt-draft', OTHER),
    ).toEqual([])
    expect(await getMeetingForEvent(db, 'evt-draft')).not.toBeNull()
  })
})

describe('commitMeetingForEvent', () => {
  it('clears the expiry so the row stops being sweepable', async () => {
    await createMeeting(db, {
      id: 'eeee-5555',
      organiserId: OWNER,
      eventId: 'evt-draft',
      expiresAt: new Date(Date.now() - HOUR),
    })

    await commitMeetingForEvent(db, 'evt-draft', OWNER)

    const row = await getMeetingForEvent(db, 'evt-draft')
    expect(row?.expiresAt).toBeNull()
    // Already past its expiry when committed — the sweep must still skip it,
    // or a slow save would lose a meeting the organiser had just kept.
    expect(await deleteExpiredMeetings(db)).toEqual([])
    expect(await getMeetingForEvent(db, 'evt-draft')).not.toBeNull()
  })

  it('makes the row immune to the provisional delete afterwards', async () => {
    await createMeeting(db, {
      id: 'ffff-6666',
      organiserId: OWNER,
      eventId: 'evt-draft',
      expiresAt: new Date(Date.now() + HOUR),
    })

    await commitMeetingForEvent(db, 'evt-draft', OWNER)

    expect(
      await deleteProvisionalMeetingForEvent(db, 'evt-draft', OWNER),
    ).toEqual([])
    expect(await getMeetingForEvent(db, 'evt-draft')).not.toBeNull()
  })

  it('is a no-op for an event with no meeting', async () => {
    await expect(
      commitMeetingForEvent(db, 'evt-none', OWNER),
    ).resolves.toBeUndefined()
  })

  it('refuses to commit another user\u2019s provisional row', async () => {
    await createMeeting(db, {
      id: 'aaaa-3030',
      organiserId: OWNER,
      eventId: 'evt-draft',
      expiresAt: new Date(Date.now() - HOUR),
    })

    await commitMeetingForEvent(db, 'evt-draft', OTHER)

    // Still sweepable: the wrong user cannot pin someone else's row alive.
    expect(await deleteExpiredMeetings(db)).toEqual(['aaaa-3030'])
  })
})

describe('the abandoned-tab path leans on the existing sweep (ADR 0018)', () => {
  it('collects a provisional meeting once its expiry passes', async () => {
    // No cleanup code runs on a killed tab. Rather than a second orphan
    // mechanism, a provisional row is simply an expiring row — which the
    // ADR 0018 cron already deletes.
    await createMeeting(db, {
      id: 'aaaa-7777',
      organiserId: OWNER,
      eventId: 'evt-abandoned',
      expiresAt: new Date(Date.now() - 1000),
    })

    expect(await deleteExpiredMeetings(db)).toEqual(['aaaa-7777'])
    expect(fake.all(meeting)).toHaveLength(0)
  })

  it('never collects a committed Event Meeting, which has no expiry', async () => {
    await createMeeting(db, {
      id: 'bbbb-8888',
      organiserId: OWNER,
      eventId: 'evt-saved',
      expiresAt: null,
    })

    expect(await deleteExpiredMeetings(db)).toEqual([])
    expect(fake.all(meeting)).toHaveLength(1)
  })
})

describe('getMeetingsForEvents', () => {
  it('resolves many events in one lookup, keyed by event id', async () => {
    await createMeeting(db, {
      id: 'cccc-9999',
      organiserId: OWNER,
      eventId: 'evt-a',
    })
    await createMeeting(db, {
      id: 'dddd-0000',
      organiserId: OWNER,
      eventId: 'evt-b',
    })
    // An Instant Meeting has no event and must never key into the map.
    await createMeeting(db, { id: 'eeee-1010', organiserId: OWNER })

    const found = await getMeetingsForEvents(db, ['evt-a', 'evt-b', 'evt-gone'])

    expect(found.get('evt-a')?.id).toBe('cccc-9999')
    expect(found.get('evt-b')?.id).toBe('dddd-0000')
    expect(found.has('evt-gone')).toBe(false)
    expect(found.size).toBe(2)
  })

  it('returns an empty map for no ids, without querying', async () => {
    expect((await getMeetingsForEvents(db, [])).size).toBe(0)
  })
})
