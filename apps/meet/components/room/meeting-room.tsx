'use client'

import { useMemo, useState } from 'react'
import { Track } from 'livekit-client'
import {
  RoomAudioRenderer,
  StartAudio,
  useTracks,
} from '@livekit/components-react'
import { cn } from '@zntr/utils'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { ParticipantTile } from '@/components/room/participant-tile'
import { ControlBar } from '@/components/room/control-bar'
import { ChatPanel } from '@/components/room/chat-panel'
import { RecordingBanner } from '@/components/room/recording-banner'

interface MeetingRoomProps {
  roomName: string
}

export function MeetingRoom({ roomName }: MeetingRoomProps) {
  const [chatOpen, setChatOpen] = useState(false)
  useKeyboardShortcuts()

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )

  const screenShareTrack = useMemo(
    () =>
      tracks.find(
        (track) => track.publication?.source === Track.Source.ScreenShare,
      ),
    [tracks],
  )
  const cameraTracks = useMemo(
    () =>
      tracks.filter(
        (track) => track.publication?.source !== Track.Source.ScreenShare,
      ),
    [tracks],
  )

  return (
    <div className="flex h-dvh flex-col bg-background">
      <RecordingBanner />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col p-3">
          {screenShareTrack ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="min-h-0 flex-1">
                <ParticipantTile trackRef={screenShareTrack} isFocus />
              </div>
              <div className="flex h-28 gap-2 overflow-x-auto">
                {cameraTracks.map((track) => (
                  <div
                    key={track.participant.identity + track.source}
                    className="aspect-video h-full shrink-0"
                  >
                    <ParticipantTile trackRef={track} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <VideoGrid count={cameraTracks.length}>
              {cameraTracks.map((track) => (
                <ParticipantTile
                  key={track.participant.identity + track.source}
                  trackRef={track}
                />
              ))}
            </VideoGrid>
          )}
        </div>
        {chatOpen ? <ChatPanel onClose={() => setChatOpen(false)} /> : null}
      </div>
      <ControlBar
        roomName={roomName}
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen((open) => !open)}
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
