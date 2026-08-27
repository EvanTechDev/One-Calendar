// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'

process.env.SALT = 'invite-token-migration-test-key'

let convertInviteTokenRecord: typeof import('@/scripts/migrate-invite-tokens').convertInviteTokenRecord
let decryptInviteToken: typeof import('@/lib/invites/invite-token').decryptInviteToken

beforeAll(async () => {
  ;({ convertInviteTokenRecord } =
    await import('@/scripts/migrate-invite-tokens'))
  ;({ decryptInviteToken } = await import('@/lib/invites/invite-token'))
})

describe('Invite Token backfill conversion', () => {
  it('converts plaintext without exposing or changing the raw credential', () => {
    const converted = convertInviteTokenRecord({
      id: 'invite-1',
      inviteToken: 'persisted-raw-token',
      inviteTokenHash: null,
    })!

    expect(converted.inviteToken).not.toBe('persisted-raw-token')
    expect(
      decryptInviteToken({
        id: 'invite-1',
        inviteToken: converted.inviteToken,
      }),
    ).toBe('persisted-raw-token')
    expect(converted.inviteTokenHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('stops on a hash paired with plaintext', () => {
    expect(() =>
      convertInviteTokenRecord({
        id: 'invite-2',
        inviteToken: 'plaintext-must-not-remain',
        inviteTokenHash: 'a'.repeat(64),
      }),
    ).toThrow(/invariant failed/)
  })
})
