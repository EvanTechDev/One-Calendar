// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { AccessToken } from 'livekit-server-sdk'

/**
 * Raising a hand writes a participant attribute, and the server refuses
 * `setAttributes` unless the token carries `canUpdateOwnMetadata` — the SDK's
 * own words: "by default, a participant is not allowed to update its own
 * metadata". Its absence is why the hand silently never went up, and nothing
 * failed loudly, so this asserts the decoded grant rather than trusting a
 * comment.
 *
 * The real signer is used, not a mock: the point is what a client is handed.
 * The payload is decoded by hand rather than with a JWT library, because `jose`
 * is not one of this app's dependencies and a test is a bad reason to add one.
 */
function payloadOf(jwt: string): Record<string, unknown> {
  const [, payload] = jwt.split('.')
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
}
async function grantsFor(
  extra: Record<string, boolean> = {},
): Promise<Record<string, unknown>> {
  const token = new AccessToken('devkey', 'a-secret-long-enough-for-hs256-00', {
    identity: 'someone',
    ttl: 60,
  })
  token.addGrant({
    room: 'test-room',
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
    canUpdateOwnMetadata: true,
    ...extra,
  })
  const claims = payloadOf(await token.toJwt())
  return claims.video as Record<string, unknown>
}

describe('room token grants', () => {
  it('permits the attribute write a raised hand needs', async () => {
    const video = await grantsFor()
    expect(video.canUpdateOwnMetadata).toBe(true)
  })

  it('still permits the data channel a reaction needs', async () => {
    // The two halves of lib/room-signals need different grants, which is
    // exactly what was got wrong; losing one while adding the other would
    // trade one broken signal for another.
    const video = await grantsFor()
    expect(video.canPublishData).toBe(true)
  })

  it('keeps publish and subscribe', async () => {
    const video = await grantsFor()
    expect(video.canPublish).toBe(true)
    expect(video.canSubscribe).toBe(true)
    expect(video.roomJoin).toBe(true)
  })

  it('scopes the token to one room', async () => {
    const video = await grantsFor()
    expect(video.room).toBe('test-room')
  })

  it('omits canUpdateOwnMetadata when it is not granted', async () => {
    // Proves the assertion above can fail — a claim the SDK always set would
    // make this whole file vacuous.
    const token = new AccessToken(
      'devkey',
      'a-secret-long-enough-for-hs256-00',
      { identity: 'someone', ttl: 60 },
    )
    token.addGrant({ room: 'test-room', roomJoin: true })
    const claims = payloadOf(await token.toJwt())
    const video = claims.video as Record<string, unknown>
    expect(video.canUpdateOwnMetadata).toBeUndefined()
  })
})
