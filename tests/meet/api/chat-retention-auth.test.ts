// @vitest-environment node
// Node, not jsdom: signing a real token goes through `jose`, whose Uint8Array
// check fails against jsdom's separate global realm.
/**
 * SEC-02: `/api/meetings/[id]/chat` was unauthenticated and spoofable.
 *
 * It had no auth of any kind and took `senderIdentity` / `senderName` verbatim
 * from the request body, so anyone who knew a room code could forge chat
 * history as any identity — including writing into the retained history of an
 * E2EE meeting whose own join screen promises "chat is not saved", which
 * ADR 0020 §2 makes a load-bearing guarantee rather than a nicety.
 *
 * Membership is now proven with the LiveKit join token the client already
 * holds, and the sender is read from its verified claims.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AccessToken } from 'livekit-server-sdk'

const API_KEY = 'devkey'
const API_SECRET = 'a-secret-long-enough-for-hs256-signing-000000'
const ROOM = 'abcd-efgh'

process.env.LIVEKIT_API_KEY = API_KEY
process.env.LIVEKIT_API_SECRET = API_SECRET

const retained: Record<string, unknown>[] = []
let meetingExists = true
let retainsChat = true

vi.mock('@zntr/meetings', () => ({
  getMeeting: async (_db: unknown, id: string) =>
    meetingExists ? { id, organiserId: 'u1', retainsChat } : null,
  getOpenSession: async () => ({ id: 'session-1' }),
  retainChatMessage: async (_db: unknown, input: Record<string, unknown>) => {
    retained.push(input)
  },
}))

vi.mock('@/lib/drizzle', () => ({ getDb: () => ({}) }))

vi.mock('@/lib/rate-limit', () => ({
  checkFixedWindowLimit: async () => ({ allowed: true, retryAfter: 0 }),
  clientAddress: () => '203.0.113.1',
}))

const { POST } = await import('@/app/api/meetings/[id]/chat/route')

/** A real join token, signed with the same key pair the route verifies with. */
async function joinToken(options: {
  room: string
  identity: string
  name?: string
  roomJoin?: boolean
  ttl?: string
}): Promise<string> {
  const token = new AccessToken(API_KEY, API_SECRET, {
    identity: options.identity,
    name: options.name,
    ttl: options.ttl ?? '5m',
  })
  token.addGrant({
    room: options.room,
    roomJoin: options.roomJoin ?? true,
    canPublish: true,
    canSubscribe: true,
  })
  return token.toJwt()
}

function post(body: unknown, id = ROOM) {
  return POST(
    {
      json: async () => body,
      headers: new Headers(),
    } as never,
    { params: Promise.resolve({ id }) },
  )
}

beforeEach(() => {
  retained.length = 0
  meetingExists = true
  retainsChat = true
})

describe('chat retention requires proof of room membership', () => {
  it('refuses a request with no token at all', async () => {
    // The pre-fix behaviour: this exact request used to be retained.
    const response = await post({
      message: 'hello',
      senderIdentity: 'user_victim',
      senderName: 'Victim',
    })
    expect(response.status).toBe(403)
    expect(retained).toHaveLength(0)
  })

  it('refuses a forged token signed with the wrong secret', async () => {
    const forged = new AccessToken(API_KEY, 'a-different-secret-entirely-000', {
      identity: 'user_attacker',
    })
    forged.addGrant({ room: ROOM, roomJoin: true })

    const response = await post({
      message: 'hello',
      participantToken: await forged.toJwt(),
    })
    expect(response.status).toBe(403)
    expect(retained).toHaveLength(0)
  })

  it('refuses a valid token minted for a DIFFERENT room', async () => {
    // Being in one meeting must not authorise writing into another's history.
    const response = await post({
      message: 'hello',
      participantToken: await joinToken({
        room: 'wxyz-1234',
        identity: 'user_1',
      }),
    })
    expect(response.status).toBe(403)
    expect(retained).toHaveLength(0)
  })

  it('refuses a token without join rights', async () => {
    const response = await post({
      message: 'hello',
      participantToken: await joinToken({
        room: ROOM,
        identity: 'user_1',
        roomJoin: false,
      }),
    })
    expect(response.status).toBe(403)
    expect(retained).toHaveLength(0)
  })

  it('refuses a token that has expired', async () => {
    // Join tokens live five minutes. A correctly-signed but expired token is no
    // longer evidence that the holder is present.
    const token = await joinToken({ room: ROOM, identity: 'user_1' })

    // Move past the token's lifetime rather than sleeping through it. The
    // verifier also allows 10s of clock tolerance, so overshoot generously.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(Date.now() + 10 * 60 * 1000)
    try {
      const response = await post({ message: 'hello', participantToken: token })
      expect(response.status).toBe(403)
      expect(retained).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('retains a message for a genuine participant', async () => {
    const response = await post({
      message: 'hello everyone',
      participantToken: await joinToken({
        room: ROOM,
        identity: 'user_1',
        name: 'Ada',
      }),
    })
    expect(response.status).toBe(200)
    expect(retained).toHaveLength(1)
    expect(retained[0]).toMatchObject({
      meetingId: ROOM,
      senderIdentity: 'user_1',
      senderName: 'Ada',
      message: 'hello everyone',
    })
  })

  it('refuses retention for E2EE even from a genuine participant', async () => {
    retainsChat = false
    const response = await post({
      message: 'must not be stored',
      participantToken: await joinToken({
        room: ROOM,
        identity: 'user_1',
        name: 'Ada',
      }),
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'Chat retention is disabled for this meeting',
    })
    expect(retained).toHaveLength(0)
  })

  it('takes the sender from the token, ignoring the body entirely', async () => {
    // The impersonation attempt: a real participant claiming to be someone else.
    const response = await post({
      message: 'transfer the funds',
      senderIdentity: 'user_ceo',
      senderName: 'The CEO',
      participantToken: await joinToken({
        room: ROOM,
        identity: 'user_intern',
        name: 'Intern',
      }),
    })
    expect(response.status).toBe(200)
    expect(retained[0]).toMatchObject({
      senderIdentity: 'user_intern',
      senderName: 'Intern',
    })
  })

  it('still rejects an empty message before looking at the token', async () => {
    const response = await post({ message: '   ' })
    expect(response.status).toBe(400)
    expect(retained).toHaveLength(0)
  })

  it('404s for a room that does not exist, only for a verified member', async () => {
    meetingExists = false
    const response = await post({
      message: 'hello',
      participantToken: await joinToken({ room: ROOM, identity: 'user_1' }),
    })
    expect(response.status).toBe(404)
    expect(retained).toHaveLength(0)
  })
})
