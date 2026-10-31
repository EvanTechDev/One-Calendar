'use client'

import { Track } from 'livekit-client'
import type { Participant } from 'livekit-client'
import {
  ConnectionQualityIndicator,
  useIsMuted,
  useIsSpeaking,
  useParticipants,
} from '@livekit/components-react'
import { Hand, MicOff, ScreenShare, X } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { cn } from '@zntr/utils'
import { useRaisedHands } from '@/hooks/use-raised-hands'

/**
 * Who is in the room.
 *
 * Without this the only roster is the name badges on video tiles — and once
 * anyone is pinned, the rest collapse into a filmstrip where most participants
 * scroll off-screen. Answering "who is here?" should not require counting
 * tiles.
 */
export function PeoplePanel({ onClose }: { onClose: () => void }) {
  const participants = useParticipants()
  const hands = useRaisedHands()

  // Raised hands first, in the order they were raised, then everyone else.
  // Ordering by raise time is what makes a queue a queue.
  const ordered = [...participants].sort((a, b) => {
    const handA = hands.get(a.identity)
    const handB = hands.get(b.identity)
    if (handA && handB) return handA - handB
    if (handA) return -1
    if (handB) return 1
    return 0
  })

  return (
    // Overlays the stage below `sm` for the same reason as the chat panel: a
    // fixed 320px column leaves no usable video on a phone.
    <aside className="absolute inset-0 z-20 flex flex-col border-l bg-background sm:relative sm:inset-auto sm:z-auto sm:w-80 sm:shrink-0">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-medium">
          People
          <span className="ml-1.5 text-muted-foreground">
            {participants.length}
          </span>
        </h2>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={onClose}
          aria-label="Close people panel"
        >
          <X className="size-4" />
        </Button>
      </div>
      <ul className="flex-1 overflow-y-auto p-2">
        {ordered.map((participant) => (
          <PersonRow
            key={participant.identity}
            participant={participant}
            handRaised={hands.has(participant.identity)}
          />
        ))}
      </ul>
    </aside>
  )
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  )
}

function PersonRow({
  participant,
  handRaised,
}: {
  participant: Participant
  handRaised: boolean
}) {
  const isSpeaking = useIsSpeaking(participant)
  const micMuted = useIsMuted({
    participant,
    source: Track.Source.Microphone,
  })
  const sharing = participant
    .getTrackPublications()
    .some((publication) => publication.source === Track.Source.ScreenShare)
  const name = participant.name || participant.identity || 'Participant'

  return (
    <li className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent">
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground',
          isSpeaking && 'ring-2 ring-primary',
        )}
      >
        {initials(name)}
      </div>
      <span className="min-w-0 flex-1 truncate text-sm">
        {name}
        {participant.isLocal ? (
          <span className="text-muted-foreground"> (you)</span>
        ) : null}
      </span>
      <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
        {handRaised ? (
          <Hand className="size-3.5 text-amber-500" aria-label="Hand raised" />
        ) : null}
        {sharing ? (
          <ScreenShare className="size-3.5" aria-label="Sharing screen" />
        ) : null}
        {micMuted ? <MicOff className="size-3.5" aria-label="Muted" /> : null}
        <ConnectionQualityIndicator participant={participant} />
      </div>
    </li>
  )
}
