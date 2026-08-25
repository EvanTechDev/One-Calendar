'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDataChannel, useLocalParticipant } from '@livekit/components-react'
import { toast } from 'sonner'
import {
  HAND_RAISED_ATTRIBUTE,
  REACTION_TOPIC,
  decodeReaction,
  encodeReaction,
} from '@/lib/room-signals'
import type { Reaction, ReactionMessage } from '@/lib/room-signals'

/** How long a reaction stays on screen. */
const REACTION_TTL_MS = 4000

export interface FloatingReaction extends ReactionMessage {
  id: string
}

/**
 * Raise-hand state and transient reactions.
 *
 * The hand is a participant attribute (durable, visible to late joiners); a
 * reaction is a data-channel message (seen once, never stored). See
 * lib/room-signals for why they differ.
 */
export function useRoomSignals() {
  const { localParticipant } = useLocalParticipant()
  const [reactions, setReactions] = useState<FloatingReaction[]>([])
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const handRaised = Boolean(
    localParticipant.attributes?.[HAND_RAISED_ATTRIBUTE],
  )

  const show = useCallback((message: ReactionMessage) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setReactions((current) => [...current, { ...message, id }])
    const timer = setTimeout(() => {
      setReactions((current) => current.filter((item) => item.id !== id))
    }, REACTION_TTL_MS)
    timers.current.push(timer)
  }, [])

  const { send } = useDataChannel(REACTION_TOPIC, (message) => {
    const decoded = decodeReaction(message.payload)
    if (decoded) show(decoded)
  })

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [])

  const toggleHand = useCallback(async () => {
    // Merged, not replaced: attributes are shared with anything else that may
    // set one, and setAttributes overwrites the whole map.
    const next = { ...localParticipant.attributes }
    if (handRaised) {
      delete next[HAND_RAISED_ATTRIBUTE]
    } else {
      next[HAND_RAISED_ATTRIBUTE] = String(Date.now())
    }
    try {
      await localParticipant.setAttributes(next)
    } catch {
      // The server rejects this without `canUpdateOwnMetadata`. That was the
      // original bug and it was invisible, because an awaited rejection in a
      // click handler surfaces nowhere the viewer can see.
      toast.error('Could not update your raised hand')
    }
  }, [handRaised, localParticipant])

  const sendReaction = useCallback(
    async (emoji: Reaction) => {
      const from =
        localParticipant.name || localParticipant.identity || 'Someone'
      // Shown locally too: the sender should see their own reaction, and the
      // data channel does not echo back to the publisher.
      show({ emoji, from })
      await send?.(encodeReaction({ emoji, from }), { reliable: false })
    },
    [localParticipant, send, show],
  )

  return { handRaised, toggleHand, sendReaction, reactions }
}
