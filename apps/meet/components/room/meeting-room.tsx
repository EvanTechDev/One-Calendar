'use client'

import { useMemo, useRef, useState } from 'react'
import { Track } from 'livekit-client'
import {
  RoomAudioRenderer,
  StartAudio,
  usePagination,
  useTracks,
  useVisualStableUpdate,
} from '@livekit/components-react'
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react'
import { ChevronLeft, ChevronRight, PanelBottomClose } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { cn } from '@zntr/utils'
import { useElementSize } from '@/hooks/use-element-size'
import {
  maxFilmstripTiles,
  maxTilesPerPage,
  filmstripIsOpen,
  videoGridColumns,
} from '@/lib/video-layout'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { ParticipantTile } from '@/components/room/participant-tile'
import { useRaisedHands } from '@/hooks/use-raised-hands'
import { useRoomChat } from '@/hooks/use-room-chat'
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

  const stageRef = useRef<HTMLDivElement>(null)
  const stage = useElementSize(stageRef)

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

  const hands = useRaisedHands()
  // Owned here rather than by the panel so history survives closing it.
  const chat = useRoomChat({
    roomName,
    retainMessages: retainChat,
    participantToken,
    isOpen: panel === 'chat',
  })

  const togglePanel = (next: 'chat' | 'people') =>
    setPanel((current) => (current === next ? null : next))

  const togglePin = (track: TrackReferenceOrPlaceholder) => {
    const key = trackKey(track)
    setPinnedKey((current) => (current === key ? null : key))
  }

  // A page's worth of tiles, chosen from the stage's own box (see
  // lib/video-layout). Everything past the page stays unmounted, which is what
  // drops its subscription — the point of the cap.
  const pageSize = focused ? maxFilmstripTiles(stage) : maxTilesPerPage(stage)
  // Keeps a speaker on the first page and stops tiles reshuffling as people
  // mute or start talking.
  const ordered = useVisualStableUpdate(others, pageSize)
  const {
    tracks: pageTracks,
    totalPageCount,
    currentPage,
    nextPage,
    prevPage,
  } = usePagination(pageSize, ordered)

  // `null` means the viewer has not chosen, so the stage decides.
  const [filmstripChoice, setFilmstripChoice] = useState<boolean | null>(null)
  // A portrait phone cannot fit the stage, a strip and the control bar at once,
  // so the strip starts collapsed there. Resolved rather than synced into
  // state: opening a panel narrows the stage enough to cross the phone
  // threshold, so a sync fired on every panel toggle and clobbered the
  // viewer's collapse — reported as the strip re-expanding when chat closed.
  const filmstripOpen = filmstripIsOpen(stage, filmstripChoice)

  return (
    <div className="flex h-dvh flex-col bg-background">
      <RecordingBanner />
      {/* `relative` anchors the chat/people panels, which overlay the stage
          below `sm` rather than splitting it. */}
      <div className="relative flex min-h-0 flex-1">
        <div
          ref={stageRef}
          className="relative flex min-w-0 flex-1 flex-col p-2 sm:p-3"
        >
          {focused ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2 sm:gap-3">
              <div className="min-h-0 flex-1">
                <ParticipantTile
                  trackRef={focused}
                  isFocus
                  isPinned={pinnedKey === trackKey(focused)}
                  onTogglePin={() => togglePin(focused)}
                  handRaised={hands.has(focused.participant.identity)}
                />
              </div>
              {others.length > 0 ? (
                filmstripOpen ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="flex h-20 flex-1 gap-2 overflow-x-auto sm:h-28">
                      {pageTracks.map((track) => (
                        <div
                          key={trackKey(track)}
                          className="aspect-video h-full shrink-0"
                        >
                          <ParticipantTile
                            trackRef={track}
                            onTogglePin={() => togglePin(track)}
                            handRaised={hands.has(track.participant.identity)}
                          />
                        </div>
                      ))}
                      {/* The strip is capped too, so say what is not in it. */}
                      {totalPageCount > 1 ? (
                        <button
                          type="button"
                          onClick={nextPage}
                          className="flex aspect-video h-full shrink-0 flex-col items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground transition-colors hover:bg-accent"
                          aria-label="Show more participants"
                        >
                          <ChevronRight className="size-4" />+
                          {ordered.length - pageTracks.length}
                        </button>
                      ) : null}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 shrink-0"
                      onClick={() => setFilmstripChoice(false)}
                      aria-label="Hide participant strip"
                    >
                      <PanelBottomClose className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0 self-center rounded-full"
                    onClick={() => setFilmstripChoice(true)}
                  >
                    Show {others.length}{' '}
                    {others.length === 1 ? 'participant' : 'participants'}
                  </Button>
                )
              ) : null}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <VideoGrid count={pageTracks.length} stage={stage}>
                {pageTracks.map((track) => (
                  <ParticipantTile
                    key={trackKey(track)}
                    trackRef={track}
                    onTogglePin={() => togglePin(track)}
                    handRaised={hands.has(track.participant.identity)}
                  />
                ))}
              </VideoGrid>
              {totalPageCount > 1 ? (
                <Pagination
                  currentPage={currentPage}
                  totalPageCount={totalPageCount}
                  onPrev={prevPage}
                  onNext={nextPage}
                />
              ) : null}
            </div>
          )}
          <ReactionOverlay reactions={reactions} />
        </div>
        {panel === 'chat' ? (
          <ChatPanel
            onClose={() => setPanel(null)}
            chat={chat}
            retainMessages={retainChat}
          />
        ) : null}
        {panel === 'people' ? (
          <PeoplePanel onClose={() => setPanel(null)} />
        ) : null}
      </div>
      <ControlBar
        unreadChat={chat.unread}
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
  stage,
  children,
}: {
  count: number
  stage: { width: number; height: number }
  children: React.ReactNode
}) {
  const columns = videoGridColumns(count, stage)
  return (
    <div
      // `place-content-stretch` rather than `center`: the rows are already
      // `1fr` of a min-h-0 flex child, so centring them left the grid
      // measuring its content and letterboxing every tile.
      className={cn('grid min-h-0 flex-1 place-content-stretch gap-2 sm:gap-3')}
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${Math.max(1, Math.ceil(count / columns))}, minmax(0, 1fr))`,
      }}
    >
      {children}
    </div>
  )
}

/**
 * Page controls for rooms bigger than one page. Rendered only when there is a
 * second page, so a normal call never sees it.
 */
function Pagination({
  currentPage,
  totalPageCount,
  onPrev,
  onNext,
}: {
  currentPage: number
  totalPageCount: number
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-2">
      <Button
        size="icon"
        variant="secondary"
        className="size-8 rounded-full"
        onClick={onPrev}
        aria-label="Previous participants"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span
        className="text-xs text-muted-foreground tabular-nums"
        aria-live="polite"
      >
        {currentPage} / {totalPageCount}
      </span>
      <Button
        size="icon"
        variant="secondary"
        className="size-8 rounded-full"
        onClick={onNext}
        aria-label="Next participants"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
