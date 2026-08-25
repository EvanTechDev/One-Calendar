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
  MoreVertical,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@zntr/ui/button'
import { cn } from '@zntr/utils'
import { SettingsDialog } from '@/components/room/settings-dialog'
import { getCreatorToken } from '@/lib/creator-token'
import { MeetingIdentity } from '@/components/room/meeting-identity'
import { Popover, PopoverContent, PopoverTrigger } from '@zntr/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@zntr/ui/dropdown-menu'
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
  /** Messages that arrived while the chat panel was closed. */
  unreadChat?: number
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
  unreadChat = 0,
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
      <div className="border-t">
        {/*
          A phone gets one line, not two. The identity block used to sit on its
          own row above the controls, which cost ~34px of a 640px-tall viewport
          and squeezed the row the viewer actually needs — reported as the
          buttons being cramped and pushed on by the info section. The room code
          is still reachable: it moved into the overflow menu's header, beside
          the copy action that is the only thing most viewers want it for.
        */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 py-3">
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

          {/*
            Mic, camera and leave stay visible at every width; the other six
            move into an overflow menu below `sm`, because nine 36px round
            buttons plus gaps need ~400px and a phone viewport is 360.
          */}
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
              onClick={() =>
                localParticipant.setCameraEnabled(!isCameraEnabled)
              }
              label={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
              onIcon={<Video className="size-4" />}
              offIcon={<VideoOff className="size-4" />}
            />

            <div
              data-region="center-secondary"
              className="hidden items-center gap-2 sm:flex"
            >
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
                className="relative rounded-full"
                onClick={() => onTogglePanel('chat')}
                aria-label={
                  unreadChat > 0
                    ? `Toggle chat, ${unreadChat} unread`
                    : 'Toggle chat'
                }
                aria-pressed={panel === 'chat'}
                title="Chat (Ctrl+Alt+C)"
              >
                <MessageSquare className="size-4" />
                {/*
                  Chat now outlives the panel, so a message can arrive while it
                  is closed. Without this the viewer has no way to know, which
                  is what made the old bug look like a lost message.
                */}
                {unreadChat > 0 ? <UnreadDot count={unreadChat} /> : null}
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
            </div>

            <OverflowMenu
              className="sm:hidden"
              panel={panel}
              onTogglePanel={onTogglePanel}
              handRaised={handRaised}
              onToggleHand={onToggleHand}
              onReaction={onReaction}
              isScreenShareEnabled={isScreenShareEnabled}
              onToggleScreenShare={toggleScreenShare}
              onOpenSettings={() => setSettingsOpen(true)}
              unreadChat={unreadChat}
              roomName={roomName}
              eventContext={eventContext}
              onCopyInvite={copyInvite}
            />

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
                size="icon"
                // `size="icon"` carries no gap (it is square by definition), so
                // widening it for a label leaves the icon touching the text.
                // 1.5 is what every non-icon size in @zntr/ui/button uses.
                className="rounded-full sm:w-auto sm:gap-1.5 sm:px-4"
                onClick={endForAll}
                disabled={ending}
                aria-label="End meeting for all"
              >
                <CircleSlash className="size-4" />
                <span className="hidden sm:inline">
                  {ending ? 'Ending…' : 'End for all'}
                </span>
              </Button>
            ) : null}
          </div>
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
 * The controls that do not fit a phone.
 *
 * A dropdown rather than a Sheet: these are one-tap toggles, and a sheet would
 * cover the video to mute a hand raise. Reactions stay inline here because the
 * emoji row is the action, not a submenu.
 */
/**
 * An unread count on a round icon button.
 *
 * Capped at 9+ because the dot sits on a 36px control and a real number would
 * outgrow it; the exact count past nine is not what the viewer needs.
 */
function UnreadDot({ count }: { count: number }) {
  return (
    <span
      aria-hidden
      className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium leading-none text-white"
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}

function OverflowMenu({
  className,
  panel,
  onTogglePanel,
  handRaised,
  onToggleHand,
  onReaction,
  isScreenShareEnabled,
  onToggleScreenShare,
  onOpenSettings,
  unreadChat,
  roomName,
  eventContext,
  onCopyInvite,
}: {
  className?: string
  panel: 'chat' | 'people' | null
  onTogglePanel: (panel: 'chat' | 'people') => void
  handRaised: boolean
  onToggleHand: () => void
  onReaction: (emoji: Reaction) => void
  isScreenShareEnabled: boolean
  onToggleScreenShare: () => void
  onOpenSettings: () => void
  unreadChat: number
  roomName: string
  eventContext?: RoomEventContext
  onCopyInvite: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="secondary"
          className={cn('relative rounded-full', className)}
          aria-label={
            unreadChat > 0
              ? `More controls, ${unreadChat} unread messages`
              : 'More controls'
          }
        >
          <MoreVertical className="size-4" />
          {/* Chat lives behind this menu on a phone, so the count has to
              surface on the trigger or it is invisible there. */}
          {unreadChat > 0 ? <UnreadDot count={unreadChat} /> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="top" className="w-56">
        {/* The room code, which no longer has its own row on a phone. */}
        <div className="flex items-center gap-2 px-2 py-1.5">
          <MeetingIdentity
            roomName={roomName}
            eventContext={eventContext}
            className="min-w-0 flex-1"
          />
          <Button
            size="icon"
            variant="ghost"
            className="size-7 shrink-0"
            onClick={onCopyInvite}
            aria-label="Copy invite link"
          >
            <LinkIcon className="size-3.5" />
          </Button>
        </div>
        <DropdownMenuSeparator />
        <div className="flex justify-between px-1 py-1.5">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="rounded-md px-1.5 py-1 text-xl transition-transform hover:scale-110 hover:bg-accent"
              onClick={() => onReaction(emoji)}
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onToggleHand}>
          <Hand className="size-4" />
          {handRaised ? 'Lower hand' : 'Raise hand'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onToggleScreenShare}>
          {isScreenShareEnabled ? (
            <MonitorX className="size-4" />
          ) : (
            <MonitorUp className="size-4" />
          )}
          {isScreenShareEnabled ? 'Stop sharing' : 'Share screen'}
        </DropdownMenuItem>
        {/* The inline buttons show open/closed through their variant; in a
            menu the same state has to be spelled out. */}
        <DropdownMenuItem onClick={() => onTogglePanel('people')}>
          <Users className="size-4" />
          {panel === 'people' ? 'Hide people' : 'People'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onTogglePanel('chat')}>
          <MessageSquare className="size-4" />
          {panel === 'chat' ? 'Hide chat' : 'Chat'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenSettings}>
          <Settings className="size-4" />
          Settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
