// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { drizzleOperatorsMock, getFakeDb } from './route-test-db'

process.env.SALT = 'invite-token-test-key-material'

vi.mock('drizzle-orm', async () => {
  const actual =
    await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm')
  return { ...actual, ...drizzleOperatorsMock }
})

vi.mock('@/lib/drizzle/client', () => ({
  getDb: () => getFakeDb().db,
}))

vi.mock('@/lib/auth/send-auth-email', () => ({ sendAuthEmail: vi.fn() }))

const { createInvitesForEvent, getGrantsByToken, readInviteToken } =
  await import('@/lib/invites/invite-service')
const { carryInvitesAcrossSplit } = await import('@/lib/invites/split-carry')
const { hashInviteToken, protectInviteToken } =
  await import('@/lib/invites/invite-token')

beforeEach(() => {
  getFakeDb().reset()
})

describe('Invite Token storage', () => {
  it('stores new tokens encrypted with a hash lookup key', async () => {
    const [created] = await createInvitesForEvent('event-1', [
      { email: 'ada@example.com' },
    ])
    const [stored] = getFakeDb().rows('event_invites')

    expect(created?.token).toBeTruthy()
    expect(stored?.inviteToken).not.toBe(created?.token)
    expect(stored?.inviteToken).toMatch(/^\{/)
    expect(stored?.inviteTokenHash).toBe(hashInviteToken(created!.token))
    expect(readInviteToken(stored as never)).toBe(created?.token)
  })

  it('read-repairs a legacy plaintext row during exact lookup', async () => {
    getFakeDb().seed(
      {
        id: 'legacy-invite',
        eventId: 'event-1',
        email: 'ada@example.com',
        inviteToken: 'legacy-raw-token',
        inviteTokenHash: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
      'event_invites',
    )

    const rows = await getGrantsByToken('legacy-raw-token')
    const repaired = getFakeDb().row('legacy-invite', 'event_invites')!

    expect(rows).toHaveLength(1)
    expect(repaired.inviteToken).not.toBe('legacy-raw-token')
    expect(repaired.inviteTokenHash).toBe(hashInviteToken('legacy-raw-token'))
  })

  it('re-encrypts the same raw token for a split destination row', async () => {
    const rawToken = 'split-stable-raw-token'
    const sourceId = 'source-invite'
    const protectedToken = protectInviteToken(sourceId, rawToken)
    getFakeDb().seed(
      {
        id: sourceId,
        eventId: 'old-master',
        email: 'ada@example.com',
        status: 'pending',
        ...protectedToken,
        emailSent: true,
        addedToCalendar: false,
        categoryId: null,
        baselineKind: 'all',
        fromStamp: null,
        untilStamp: null,
        expiresAt: new Date('2027-01-01T00:00:00Z'),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
      'event_invites',
    )

    await carryInvitesAcrossSplit(getFakeDb().db as never, {
      oldMasterId: 'old-master',
      newMasterId: 'new-master',
      boundaryStamp: '20260901T090000Z',
      clockSource: new Date('2026-09-01T09:00:00Z'),
    })

    const carried = getFakeDb()
      .rows('event_invites')
      .find((row) => row.eventId === 'new-master')!
    expect(carried.inviteTokenHash).toBe(protectedToken.inviteTokenHash)
    expect(carried.inviteToken).not.toBe(protectedToken.inviteToken)
    expect(readInviteToken(carried as never)).toBe(rawToken)
  })
})
