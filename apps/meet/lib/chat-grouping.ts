/**
 * Grouping consecutive chat messages by sender.
 *
 * The panel is 320px wide, so the per-message sender line was the single
 * heaviest thing in it: a run of three one-word replies spent three lines
 * naming the same person. Grouping is what every chat client does, and it is
 * also what lets a timestamp be added without costing a line per message —
 * the group header carries both.
 *
 * Pure, and shaped after lib/video-layout: the panel renders whatever this
 * returns, so the rule is testable without a DOM.
 */

export interface ChatMessageLike {
  id: string
  message: string
  timestamp: number
  from?: {
    identity?: string
    name?: string
    isLocal?: boolean
  }
}

export interface ChatGroupMessage {
  id: string
  message: string
  timestamp: number
}

export interface ChatGroup {
  /** Stable across re-renders: the first message's id. */
  key: string
  /** Who sent the run. Locality is part of it so a local and a remote
   * participant sharing a name can never be folded together. */
  senderKey: string
  /** What the header shows. */
  senderName: string
  isLocal: boolean
  /** The run's first message time — the one the header displays. */
  timestamp: number
  messages: ChatGroupMessage[]
}

/**
 * How far apart two messages from one sender may be and still read as one run.
 * Five minutes is long enough that a back-and-forth stays grouped, short enough
 * that a reply after a silence gets its own header — which is the point of
 * showing the time at all.
 */
export const CHAT_GROUP_GAP_MS = 5 * 60 * 1000

export function groupChatMessages(
  messages: ChatMessageLike[],
  gapMs: number = CHAT_GROUP_GAP_MS,
): ChatGroup[] {
  const groups: ChatGroup[] = []

  for (const message of messages) {
    const isLocal = message.from?.isLocal ?? false
    const senderKey = `${isLocal ? 'local' : 'remote'}:${
      message.from?.identity || message.from?.name || 'unknown'
    }`
    const last = groups.at(-1)
    const previous = last?.messages.at(-1)

    // Absolute difference, not a forward one: LiveKit timestamps come off the
    // sender's clock, so a skewed peer can deliver a message stamped in the
    // past. Either direction of a large jump means "not the same run".
    const continues =
      last !== undefined &&
      previous !== undefined &&
      last.senderKey === senderKey &&
      Math.abs(message.timestamp - previous.timestamp) <= gapMs

    if (continues) {
      last.messages.push({
        id: message.id,
        message: message.message,
        timestamp: message.timestamp,
      })
      continue
    }

    groups.push({
      key: message.id,
      senderKey,
      senderName: isLocal
        ? 'You'
        : message.from?.name || message.from?.identity || 'Participant',
      isLocal,
      timestamp: message.timestamp,
      messages: [
        {
          id: message.id,
          message: message.message,
          timestamp: message.timestamp,
        },
      ],
    })
  }

  return groups
}
