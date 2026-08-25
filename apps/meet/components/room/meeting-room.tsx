'use client'

import { useMemo, useState } from 'react'
import { Track } from 'livekit-client'
import {
  RoomAudioRenderer,
  StartAudio,
  useTracks,
} from '@livekit/components-react'
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react'
import { cn } from '@zntr/utils'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { ParticipantTile } from '@/components/room/participant-tile'
import { ControlBar } from '@/components/room/control-bar'
import { ChatPanel } from '@/components/room/chat-panel'
import { RecordingBanner } from '@/components/room/recording-banner'
import { PeoplePanel } from '@/components/room/people-panel'
import { ReactionOverlay } from '@/components/room/reaction-overlay'
import { useRoomSignals } from '@/hooks/use-room-signals'
import type { RoomEventContext } from '@/lib/event-context'

interface MeetingRoomProps {
  roomName: string
  /** Called when the user deliberately leaves, so a drop screen is skipped. */
  onLeaveIntent: () => void
  /** False in encrypted rooms, where chat is never retained (ADR 0020). */
  retainChat: boolean
  /** The calendar event this room belongs to, when it has one. */
  eventContext?: RoomEventContext
  /**
   * The LiveKit join token, forwarded to chat retention as proof of room
   * membership — the endpoint derives the sender's identity from it rather than
   * trusting a client-supplied name.
   */
  participantToken: string
}

/** Stable per-track key, also used as the focus identifier. */
function trackKey(track: TrackReferenceOrPlaceholder): string {
  return `${track.participant.identity}/${track.source}`
}

export function MeetingRoom({
  roomName,
  onLeaveIntent,
  retainChat,
  participantToken,
  eventContext,
}: MeetingRoomProps) {
  // One panel at a time: chat and people compete for the same 320px, and two
  // booleans let both open at once.
  const [panel, setPanel] = useState<'chat' | 'people' | null>(null)
  const [pinnedKey, setPinnedKey] = useState<string | null>(null)
  const { handRaised, toggleHand, sendReaction, reactions } = useRoomSignals()
  useKeyboardShortcuts({
    onToggleChat: () => togglePanel('chat'),
    onTogglePeople: () => togglePanel('people'),
    onToggleHand: toggleHand,
  })

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )

  const screenShares = useMemo(
    () =>
      tracks.filter(
        (track) => track.publication?.source === Track.Source.ScreenShare,
      ),
    [tracks],
  )

  /**
   * Focus resolution: an explicit pin wins, then the newest screen share,
   * then nothing (grid). A pin on a track that has since gone away falls
   * back rather than showing an empty stage.
   */
  const focused = useMemo(() => {
    if (pinnedKey) {
      const pinned = tracks.find((track) => trackKey(track) === pinnedKey)
      if (pinned) return pinned
    }
    return screenShares.at(-1)
  }, [pinnedKey, tracks, screenShares])

  const others = useMemo(
    () => tracks.filter((track) => track !== focused),
    [tracks, focused],
  )

  const togglePanel = (next: 'chat' | 'people') =>
    setPanel((current) => (current === next ? null : next))

  const togglePin = (track: TrackReferenceOrPlaceholder) => {
    const key = trackKey(track)
    setPinnedKey((current) => (current === key ? null : key))
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <RecordingBanner />
      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-w-0 flex-1 flex-col p-3">
          {focused ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="min-h-0 flex-1">
                <ParticipantTile
                  trackRef={focused}
                  isFocus
                  isPinned={pinnedKey === trackKey(focused)}
                  onTogglePin={() => togglePin(focused)}
                />
              </div>
              {others.length > 0 ? (
                <div className="flex h-28 gap-2 overflow-x-auto">
                  {others.map((track) => (
                    <div
                      key={trackKey(track)}
                      className="aspect-video h-full shrink-0"
                    >
                      <ParticipantTile
                        trackRef={track}
                        onTogglePin={() => togglePin(track)}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <VideoGrid count={others.length}>
              {others.map((track) => (
                <ParticipantTile
                  key={trackKey(track)}
                  trackRef={track}
                  onTogglePin={() => togglePin(track)}
                />
              ))}
            </VideoGrid>
          )}
          <ReactionOverlay reactions={reactions} />
        </div>
        {panel === 'chat' ? (
          <ChatPanel
            onClose={() => setPanel(null)}
            roomName={roomName}
            retainMessages={retainChat}
            participantToken={participantToken}
          />
        ) : null}
        {panel === 'people' ? (
          <PeoplePanel onClose={() => setPanel(null)} />
        ) : null}
      </div>
      <ControlBar
        roomName={roomName}
        panel={panel}
        onTogglePanel={togglePanel}
        handRaised={handRaised}
        onToggleHand={toggleHand}
        onReaction={sendReaction}
        onLeaveIntent={onLeaveIntent}
        eventContext={eventContext}
      />
      <RoomAudioRenderer />
      <StartAudio
        label="Click to allow audio playback"
        className="absolute left-1/2 top-4 -translate-x-1/2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
      />
    </div>
  )
}

function VideoGrid({
  count,
  children,
}: {
  count: number
  children: React.ReactNode
}) {
  const columns = count <= 1 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : 4
  return (
    <div
      className={cn('grid min-h-0 flex-1 place-content-center gap-3')}
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridAutoRows: 'minmax(0, 1fr)',
      }}
    >
      {children}
    </div>
  )
}
