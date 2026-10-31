'use client'

import { useEffect, useState } from 'react'
import { useRoomContext } from '@livekit/components-react'
import { RoomEvent } from 'livekit-client'
import type { Participant } from 'livekit-client'
import { HAND_RAISED_ATTRIBUTE, parseRaisedAt } from '@/lib/room-signals'

/**
 * Raise timestamps for everyone whose hand is up, keyed by identity.
 *
 * Subscribed at the room level rather than read off `participant.attributes`,
 * because `useParticipants` does not re-render on an attribute change — a plain
 * read is a snapshot taken at mount, so a hand raised afterwards never showed
 * up until some unrelated event happened to re-render. One room-level
 * subscription rather than one per row, because the panel sorts by raise order
 * and a sort cannot call a per-participant hook.
 */
export function useRaisedHands(): ReadonlyMap<string, number> {
  const room = useRoomContext()
  const [hands, setHands] = useState<ReadonlyMap<string, number>>(new Map())

  useEffect(() => {
    const read = () => {
      const next = new Map<string, number>()
      const everyone: Participant[] = [
        room.localParticipant,
        ...room.remoteParticipants.values(),
      ]
      for (const participant of everyone) {
        const at = parseRaisedAt(
          participant.attributes?.[HAND_RAISED_ATTRIBUTE],
        )
        if (at !== null) next.set(participant.identity, at)
      }
      setHands(next)
    }

    read()
    // Connection/disconnection events matter as much as the attribute event: a
    // late joiner arrives with a hand already up (that is why the hand is an
    // attribute at all), and a leaver's hand must not linger in the queue.
    room
      .on(RoomEvent.ParticipantAttributesChanged, read)
      .on(RoomEvent.ParticipantConnected, read)
      .on(RoomEvent.ParticipantDisconnected, read)
      .on(RoomEvent.LocalTrackPublished, read)

    return () => {
      room
        .off(RoomEvent.ParticipantAttributesChanged, read)
        .off(RoomEvent.ParticipantConnected, read)
        .off(RoomEvent.ParticipantDisconnected, read)
        .off(RoomEvent.LocalTrackPublished, read)
    }
  }, [room])

  return hands
}
