import { verifyCreatorToken } from '@zntr/meetings'
import type { Meeting } from '@zntr/meetings'
import { getServerSession } from '@/lib/auth/server'

/**
 * Decides whether the caller holds Organiser authority over a Meeting
 * (ADR 0016): either they are the signed-in owner, or they present the
 * Creator Token issued when they created it as a guest.
 *
 * Always re-checked server-side — the `organiser` flag in a LiveKit token's
 * metadata is for UI only.
 */
export async function isOrganiser(
  meeting: Meeting,
  presentedCreatorToken?: string | null,
): Promise<boolean> {
  const session = await getServerSession()
  if (session && meeting.organiserId === session.user.id) return true
  return verifyCreatorToken(presentedCreatorToken, meeting.creatorTokenHash)
}
