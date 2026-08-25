'use client'

import { useState } from 'react'
import { useLocalParticipant, useRoomContext } from '@livekit/components-react'
import {
  Mic,
  MicOff,
  MessageSquare,
  MonitorUp,
  MonitorX,
  PhoneOff,
  Settings,
  Video,
  VideoOff,
  Link as LinkIcon,
  CircleSlash,
  Hand,
  Users,
  Smile,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@zntr/ui/button'
import { cn } from '@zntr/utils'
import { SettingsDialog } from '@/components/room/settings-dialog'
import { getCreatorToken } from '@/lib/creator-token'
import { MeetingIdentity } from '@/components/room/meeting-identity'
import { Popover, PopoverContent, PopoverTrigger } from '@zntr/ui/popover'
import { REACTIONS } from '@/lib/room-signals'
import type { Reaction } from '@/lib/room-signals'
import type { RoomEventContext } from '@/lib/event-context'

interface ControlBarProps {
  roomName: string
  panel: 'chat' | 'people' | null
  onTogglePanel: (panel: 'chat' | 'people') => void
  handRaised: boolean
  onToggleHand: () => void
  onReaction: (emoji: Reaction) => void
  onLeaveIntent: () => void
  eventContext?: RoomEventContext
}

export function ControlBar({
  roomName,
  panel,
  onTogglePanel,
  handRaised,
  onToggleHand,
  onReaction,
  onLeaveIntent,
  eventContext,
}: ControlBarProps) {
  const room = useRoomContext()
  const {
    localParticipant,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
  } = useLocalParticipant()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [ending, setEnding] = useState(false)

  // Advertised by the token's metadata for UI purposes only — the end
  // endpoint re-authenticates the Organiser server-side (ADR 0016).
  const isOrganiser = (() => {
    try {
      const metadata = localParticipant.metadata
      if (!metadata) return false
      return Boolean(JSON.parse(metadata)?.organiser)
    } catch {
      return false
    }
  })()

  const endForAll = async () => {
    setEnding(true)
    onLeaveIntent()
    try {
      const response = await fetch(`/api/meetings/${roomName}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorToken: getCreatorToken(roomName) }),
      })
      if (!response.ok) throw new Error('End failed')
      await room.disconnect()
    } catch {
      toast.error('Could not end the meeting')
    } finally {
      setEnding(false)
    }
  }

  const copyInvite = async () => {
    // Preserve the hash so E2EE invites carry the passphrase.
    await navigator.clipboard.writeText(window.location.href)
    toast.success('Invite link copied')
  }

  const toggleScreenShare = async () => {
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled, {
        audio: true,
      })
    } catch {
      // User cancelled the picker — not an error.
    }
  }

  return (
    <>
      {/*
        Three independent regions, so the middle cluster is centred on the
        viewport rather than on whatever is left over. `minmax(0, 1fr)` on both
        side tracks is the load-bearing part: a bare `1fr` resolves to
        `minmax(auto, 1fr)`, which lets a long event title in the left region
        claim more than its share and push the controls off-centre. With an
        explicit 0 minimum the two side tracks are always the same width, so
        the centre track sits exactly in the middle regardless of role
        (Organiser-only actions live on the right) or event title.
      */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-t px-4 py-3">
        <div
          data-region="left"
          className="hidden min-w-0 items-center gap-2 sm:flex"
        >
          <MeetingIdentity roomName={roomName} eventContext={eventContext} />
          <Button
            size="icon"
            variant="ghost"
            className="size-7 shrink-0"
            onClick={copyInvite}
            aria-label="Copy invite link"
          >
            <LinkIcon className="size-3.5" />
          </Button>
        </div>

        <div
          data-region="center"
          className="flex items-center justify-center gap-2"
        >
          <ControlButton
            active={isMicrophoneEnabled}
            onClick={() =>
              localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
            }
            label={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
            onIcon={<Mic className="size-4" />}
            offIcon={<MicOff className="size-4" />}
          />
          <ControlButton
            active={isCameraEnabled}
            onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
            label={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
            onIcon={<Video className="size-4" />}
            offIcon={<VideoOff className="size-4" />}
          />
          <Button
            size="icon"
            variant={isScreenShareEnabled ? 'default' : 'secondary'}
            className="rounded-full"
            onClick={toggleScreenShare}
            aria-label={
              isScreenShareEnabled ? 'Stop sharing screen' : 'Share screen'
            }
          >
            {isScreenShareEnabled ? (
              <MonitorX className="size-4" />
            ) : (
              <MonitorUp className="size-4" />
            )}
          </Button>
          <Button
            size="icon"
            variant={handRaised ? 'default' : 'secondary'}
            className="rounded-full"
            onClick={onToggleHand}
            aria-label={handRaised ? 'Lower hand' : 'Raise hand'}
            aria-pressed={handRaised}
            title="Raise hand (Ctrl+Alt+H)"
          >
            <Hand className="size-4" />
          </Button>
          <ReactionPicker onReaction={onReaction} />
          <Button
            size="icon"
            variant={panel === 'people' ? 'default' : 'secondary'}
            className="rounded-full"
            onClick={() => onTogglePanel('people')}
            aria-label="Toggle people"
            aria-pressed={panel === 'people'}
            title="People (Ctrl+Alt+P)"
          >
            <Users className="size-4" />
          </Button>
          <Button
            size="icon"
            variant={panel === 'chat' ? 'default' : 'secondary'}
            className="rounded-full"
            onClick={() => onTogglePanel('chat')}
            aria-label="Toggle chat"
            aria-pressed={panel === 'chat'}
            title="Chat (Ctrl+Alt+C)"
          >
            <MessageSquare className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="rounded-full"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
          >
            <Settings className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="destructive"
            className="rounded-full"
            onClick={() => {
              onLeaveIntent()
              room.disconnect()
            }}
            aria-label="Leave meeting"
          >
            <PhoneOff className="size-4" />
          </Button>
        </div>

        {/*
          Host controls sit on the right, matching where Google Meet puts
          them. Keeping "End for all" out of the centre cluster is what stops
          the centre from shifting between a guest and the Organiser (ADR
          0016 — ending is the Organiser's explicit act, so only they see it).
        */}
        <div
          data-region="right"
          className="flex min-w-0 items-center justify-end gap-2"
        >
          {isOrganiser ? (
            <Button
              variant="destructive"
              className="rounded-full"
              onClick={endForAll}
              disabled={ending}
            >
              <CircleSlash className="size-4" />
              <span className="hidden sm:inline">
                {ending ? 'Ending…' : 'End for all'}
              </span>
            </Button>
          ) : null}
        </div>
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  )
}

function ControlButton({
  active,
  onClick,
  label,
  onIcon,
  offIcon,
}: {
  active: boolean
  onClick: () => void
  label: string
  onIcon: React.ReactNode
  offIcon: React.ReactNode
}) {
  return (
    <Button
      size="icon"
      variant={active ? 'secondary' : 'destructive'}
      className={cn('rounded-full')}
      onClick={onClick}
      aria-label={label}
    >
      {active ? onIcon : offIcon}
    </Button>
  )
}

/**
 * Reactions, behind a popover so six emoji do not permanently occupy the
 * control bar.
 */
function ReactionPicker({
  onReaction,
}: {
  onReaction: (emoji: Reaction) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="secondary"
          className="rounded-full"
          aria-label="Send a reaction"
        >
          <Smile className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-1.5" align="center" side="top">
        <div className="flex gap-0.5">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="rounded-md px-2 py-1 text-xl transition-transform hover:scale-110 hover:bg-accent"
              onClick={() => {
                onReaction(emoji)
                setOpen(false)
              }}
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
