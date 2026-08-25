import { TokenVerifier } from 'livekit-server-sdk'

/**
 * Proof that a caller is actually in a room, derived from the LiveKit join
 * token they already hold.
 *
 * The chat-retention endpoint used to take `senderIdentity` and `senderName`
 * verbatim from the request body with no authentication at all, so anyone who
 * knew a room code could forge chat history as any identity — including writing
 * into the stored history of an E2EE meeting whose own join screen promises
 * "chat is not saved" (ADR 0020 §2 makes that promise load-bearing).
 *
 * The join token is the right credential here because it is the only thing that
 * distinguishes a participant from a passer-by: it is signed with the same API
 * key pair, scoped to one room, short-lived (5 minutes), and the client already
 * has it. Identity comes from the verified claims, never from the body.
 */
export interface VerifiedMember {
  identity: string
  name: string
}

/**
 * Verifies `token` and confirms its room grant matches `room`.
 *
 * Returns null for every failure — bad signature, expired, wrong room, or a
 * token without join rights. The caller must not distinguish these to the
 * client; "not a member" is the only useful answer.
 */
export async function verifyRoomMember(
  token: string | null | undefined,
  room: string,
): Promise<VerifiedMember | null> {
  if (!token) return null
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  if (!apiKey || !apiSecret) return null

  try {
    const claims = await new TokenVerifier(apiKey, apiSecret).verify(token)
    const grant = claims.video
    // A token minted for a DIFFERENT room must not authorise writes here, and
    // one without roomJoin is not a participant's token at all.
    if (!grant?.roomJoin || grant.room !== room) return null
    const identity = claims.sub
    if (!identity) return null
    return { identity, name: claims.name || identity }
  } catch {
    // Expired, tampered with, or signed by another key pair.
    return null
  }
}
