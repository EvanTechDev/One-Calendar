/**
 * In-room signalling that is not media: raised hands and reactions.
 *
 * Two different mechanisms on purpose:
 *
 * - A raised hand is **state**, so it lives in a participant attribute. It
 *   survives, and a late joiner sees hands that were already up. The value is
 *   the raise timestamp rather than a boolean, because a hand queue without an
 *   order is not a queue.
 * - A reaction is an **event**, so it goes over the data channel. It is meant
 *   to be seen once and forgotten; persisting it would mean cleaning it up.
 *
 * The two need different token grants, which is easy to get wrong: a reaction
 * rides `canPublishData`, but an attribute write needs `canUpdateOwnMetadata`,
 * which is NOT on by default. See app/api/connection-details/route.ts.
 */

export const HAND_RAISED_ATTRIBUTE = 'handRaisedAt'

export const REACTION_TOPIC = 'reaction'

/**
 * The raise timestamp, or null when the hand is down.
 *
 * Attributes are strings on the wire, so every reader has to parse — and a
 * hand queue ordered by a NaN is not ordered at all.
 */
export function parseRaisedAt(raw: string | undefined): number | null {
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

/** The reactions offered in the control bar, in display order. */
export const REACTIONS = ['👍', '🎉', '👏', '😂', '😮', '❤️'] as const

export type Reaction = (typeof REACTIONS)[number]

export interface ReactionMessage {
  emoji: Reaction
  /** Sender's display name, so a reaction can be attributed. */
  from: string
}

export function isReaction(value: unknown): value is Reaction {
  return REACTIONS.includes(value as Reaction)
}

export function encodeReaction(message: ReactionMessage): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(message))
}

export function decodeReaction(payload: Uint8Array): ReactionMessage | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(payload)) as unknown
    if (typeof parsed !== 'object' || parsed === null) return null
    const { emoji, from } = parsed as Partial<ReactionMessage>
    if (!isReaction(emoji) || typeof from !== 'string') return null
    return { emoji, from }
  } catch {
    return null
  }
}
