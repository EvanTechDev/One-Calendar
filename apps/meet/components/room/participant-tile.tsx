'use client'

import { Track } from 'livekit-client'
import {
  AudioTrack,
  VideoTrack,
  isTrackReference,
  useIsMuted,
  useIsSpeaking,
} from '@livekit/components-react'
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react'
import { MicOff, ScreenShare } from 'lucide-react'
import { cn } from '@zntr/utils'

interface ParticipantTileProps {
  trackRef: TrackReferenceOrPlaceholder
  isFocus?: boolean
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

export function ParticipantTile({ trackRef, isFocus }: ParticipantTileProps) {
  const { participant } = trackRef
  const isScreenShare = trackRef.source === Track.Source.ScreenShare
  const isSpeaking = useIsSpeaking(participant)
  const isMicMuted = useIsMuted({
    participant,
    source: Track.Source.Microphone,
  })
  const isCameraMuted = useIsMuted({
    participant,
    source: Track.Source.Camera,
  })

  const hasVideo =
    isTrackReference(trackRef) &&
    !!trackRef.publication.track &&
    (isScreenShare || !isCameraMuted)

  const displayName = participant.name || participant.identity || 'Participant'

  return (
    <div
      className={cn(
        'relative size-full min-h-0 overflow-hidden rounded-xl bg-muted transition-shadow',
        isSpeaking && !isScreenShare && 'ring-2 ring-primary',
      )}
    >
      {hasVideo ? (
        <VideoTrack
          trackRef={trackRef}
          className={cn(
            'size-full',
            isScreenShare ? 'object-contain' : 'object-cover',
            participant.isLocal && !isScreenShare && '-scale-x-100',
          )}
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <div
            className={cn(
              'flex items-center justify-center rounded-full bg-secondary font-medium text-secondary-foreground',
              isFocus ? 'size-24 text-3xl' : 'size-14 text-lg',
            )}
          >
            {initials(displayName)}
          </div>
        </div>
      )}
      {isScreenShare && isTrackReference(trackRef) && !participant.isLocal ? (
        <AudioTrack trackRef={trackRef} />
      ) : null}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
        {isScreenShare ? (
          <ScreenShare className="size-3" />
        ) : isMicMuted ? (
          <MicOff className="size-3 text-red-400" />
        ) : null}
        <span className="max-w-40 truncate">
          {displayName}
          {participant.isLocal && !isScreenShare ? ' (you)' : ''}
          {isScreenShare ? "'s screen" : ''}
        </span>
      </div>
    </div>
  )
}
