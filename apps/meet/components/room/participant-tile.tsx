'use client'

import { Track } from 'livekit-client'
import {
  ConnectionQualityIndicator,
  VideoTrack,
  isTrackReference,
  useIsMuted,
  useIsSpeaking,
} from '@livekit/components-react'
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react'
import { Hand, Maximize2, MicOff, Minimize2, ScreenShare } from 'lucide-react'
import { cn } from '@zntr/utils'
import { useMirrorLocalVideo } from '@/hooks/use-mirror-local-video'

interface ParticipantTileProps {
  trackRef: TrackReferenceOrPlaceholder
  isFocus?: boolean
  isPinned?: boolean
  onTogglePin?: () => void
  /**
   * Passed in rather than subscribed here: the room already keeps one
   * subscription for the whole roster (hooks/use-raised-hands), and one per
   * tile would be a subscription per participant per render surface.
   */
  handRaised?: boolean
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

export function ParticipantTile({
  trackRef,
  isFocus,
  isPinned,
  onTogglePin,
  handRaised,
}: ParticipantTileProps) {
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

  // Only a front camera is mirrored. Mirroring is for the mirror-intuition of
  // watching yourself; a rear camera is pointed at the world, where a flip just
  // reverses it. The old rule tested `isLocal` alone and flipped both.
  const mirrored = useMirrorLocalVideo(trackRef, isScreenShare)

  const displayName = participant.name || participant.identity || 'Participant'
  const interactive = Boolean(onTogglePin)
  const pinLabel = isFocus ? `Shrink ${displayName}` : `Enlarge ${displayName}`

  return (
    <div
      className={cn(
        'group relative size-full min-h-0 overflow-hidden rounded-xl bg-muted transition-shadow',
        isSpeaking && !isScreenShare && 'ring-2 ring-primary',
        interactive && 'cursor-pointer',
      )}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? pinLabel : undefined}
      aria-pressed={interactive ? Boolean(isPinned) : undefined}
      onClick={onTogglePin}
      onKeyDown={(event) => {
        if (!onTogglePin) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onTogglePin()
        }
      }}
    >
      {hasVideo ? (
        <VideoTrack
          trackRef={trackRef}
          // `object-contain` for camera video too, not just screen share.
          // `object-cover` scaled the frame up and cut its edges off to fill a
          // cell whose shape the grid decided — faces lost their sides, and the
          // more the cell differed from the source the more went missing. The
          // frame is now shown whole; the grid's job is to pick a cell shape
          // that leaves little to letterbox (see lib/video-layout).
          className={cn('size-full object-contain', mirrored && '-scale-x-100')}
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
      {interactive ? (
        <div
          aria-hidden
          className="absolute right-2 top-2 rounded-md bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {isFocus ? (
            <Minimize2 className="size-3.5" />
          ) : (
            <Maximize2 className="size-3.5" />
          )}
        </div>
      ) : null}
      {/*
        A raised hand belongs on the tile, not only in the People panel — the
        panel is closed by default, so a hand raised there is a hand nobody in
        the meeting sees.
      */}
      {handRaised && !isScreenShare ? (
        <div
          className="absolute left-2 top-2 rounded-md bg-black/60 p-1.5"
          aria-label={`${displayName} raised their hand`}
        >
          <Hand className="size-3.5 text-amber-400" />
        </div>
      ) : null}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
        {isScreenShare ? (
          <ScreenShare className="size-3" />
        ) : isMicMuted ? (
          <MicOff className="size-3 text-red-400" />
        ) : null}
        <ConnectionQualityIndicator participant={participant} />
        <span className="max-w-40 truncate">
          {displayName}
          {participant.isLocal && !isScreenShare ? ' (you)' : ''}
          {isScreenShare ? "'s screen" : ''}
        </span>
      </div>
    </div>
  )
}
