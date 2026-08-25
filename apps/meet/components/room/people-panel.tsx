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
import { HAND_RAISED_ATTRIBUTE } from '@/lib/room-signals'

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

  // Raised hands first, in the order they were raised, then everyone else.
  // Ordering by raise time is what makes a queue a queue.
  const ordered = [...participants].sort((a, b) => {
    const handA = raisedAt(a)
    const handB = raisedAt(b)
    if (handA && handB) return handA - handB
    if (handA) return -1
    if (handB) return 1
    return 0
  })

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l">
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
          <PersonRow key={participant.identity} participant={participant} />
        ))}
      </ul>
    </aside>
  )
}

function raisedAt(participant: Participant): number | null {
  const raw = participant.attributes?.[HAND_RAISED_ATTRIBUTE]
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
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

function PersonRow({ participant }: { participant: Participant }) {
  const isSpeaking = useIsSpeaking(participant)
  const micMuted = useIsMuted({
    participant,
    source: Track.Source.Microphone,
  })
  const sharing = participant
    .getTrackPublications()
    .some((publication) => publication.source === Track.Source.ScreenShare)
  const handRaised = raisedAt(participant) !== null
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
