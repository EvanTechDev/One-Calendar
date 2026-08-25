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
        From `sm` up: three independent regions, so the middle cluster is centred
        on the viewport rather than on whatever is left over. `minmax(0, 1fr)` on
        both side tracks is the load-bearing part: a bare `1fr` resolves to
        `minmax(auto, 1fr)`, which lets a long event title in the left region
        claim more than its share and push the controls off-centre. With an
        explicit 0 minimum the two side tracks are always the same width, so the
        centre track sits exactly in the middle regardless of role
        (Organiser-only actions live on the right) or event title.

        Below `sm` the grid is off entirely and the bar is two flex rows. A phone
        has no left region to centre against — it was hidden — so the grid there
        only cost the controls half the viewport for an empty third track, which
        is what forced six of them into a dropdown.
      */}
      <div className="border-t">
        {/*
          A phone gets the six secondary controls as a visible row of its own,
          above the primary line. They were behind a dropdown because they did
          not fit — but the reason they did not fit was that the centring grid
          gave them one `minmax(0,1fr)` track, about half the viewport, while
          the third track sat empty at 360px. Spending the full width instead
          fits all six at a 40px target (see lib/control-layout), which puts
          chat and its unread badge back on screen and every toggle back to one
          tap.

          A sibling of the grid, not a fourth track: at `sm` it is
          `display:none`, so it is not a grid item and the three tracks below
          are exactly as they were.
        */}
        <div
          data-region="mobile-secondary"
          className="flex items-center justify-between gap-0.5 px-3 pt-2 sm:hidden"
        >
          <SecondaryControls
            buttonClassName="size-11"
            panel={panel}
            onTogglePanel={onTogglePanel}
            handRaised={handRaised}
            onToggleHand={onToggleHand}
            onReaction={onReaction}
            isScreenShareEnabled={isScreenShareEnabled}
            onToggleScreenShare={toggleScreenShare}
            onOpenSettings={() => setSettingsOpen(true)}
            unreadChat={unreadChat}
          />
        </div>
        {/*
          One flex line on a phone, the three-track grid from `sm` up. The
          identity block still has no row of its own — that cost ~34px of a
          640px viewport — and the room code stays reachable through the details
          menu beside the primary controls.
        */}
        <div className="flex items-center gap-2 px-3 py-2 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:px-4 sm:py-3">
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
            Mic, camera, the details menu and Leave stay visible at every width.
            The other six are inline from `sm` up and live in the row above on a
            phone — no longer behind the details menu, which is why that menu
            keeps only what has no button of its own: the room code and copy.

            On a phone this is the flex line's only growing child, so
            `justify-center` centres its contents in the full width; from `sm`
            it is the grid's middle track and the side tracks do the centring.
          */}
          <div
            data-region="center"
            className="flex flex-1 items-center justify-center gap-2 sm:flex-none"
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
              <SecondaryControls
                panel={panel}
                onTogglePanel={onTogglePanel}
                handRaised={handRaised}
                onToggleHand={onToggleHand}
                onReaction={onReaction}
                isScreenShareEnabled={isScreenShareEnabled}
                onToggleScreenShare={toggleScreenShare}
                onOpenSettings={() => setSettingsOpen(true)}
                unreadChat={unreadChat}
              />
            </div>

            <DetailsMenu
              className="size-11 sm:hidden"
              roomName={roomName}
              eventContext={eventContext}
              onCopyInvite={copyInvite}
            />

            {/*
              Held away from the toggles rather than sitting one 8px gap from
              Mute: leaving the call was a thumb-slip from muting. The margin is
              phone-only — a mouse does not slip, and the desktop centre track's
              measured width is asserted to be role-independent.
            */}
            <Button
              size="icon"
              variant="destructive"
              className="ml-4 size-11 rounded-full sm:ml-0 sm:size-8"
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
                className="size-11 rounded-full sm:size-8 sm:w-auto sm:gap-1.5 sm:px-4"
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
      // 44px on a phone (the iOS minimum, see lib/control-layout), the ordinary
      // 32px `size="icon"` from `sm` up where a pointer is doing the aiming.
      className={cn('size-11 rounded-full sm:size-8')}
      onClick={onClick}
      aria-label={label}
    >
      {active ? onIcon : offIcon}
    </Button>
  )
}

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

/**
 * The six secondary toggles: share, hand, reactions, people, chat, settings.
 *
 * One definition rendered twice — inline in the desktop centre track, and in the
 * phone's own row above the primary line. Two copies of six buttons is how the
 * phone's chat control drifted into a menu item with a different label and no
 * `aria-pressed` from the desktop one.
 */
function SecondaryControls({
  buttonClassName,
  panel,
  onTogglePanel,
  handRaised,
  onToggleHand,
  onReaction,
  isScreenShareEnabled,
  onToggleScreenShare,
  onOpenSettings,
  unreadChat,
}: {
  /** Sizing for the phone row; the desktop cluster keeps the default. */
  buttonClassName?: string
  panel: 'chat' | 'people' | null
  onTogglePanel: (panel: 'chat' | 'people') => void
  handRaised: boolean
  onToggleHand: () => void
  onReaction: (emoji: Reaction) => void
  isScreenShareEnabled: boolean
  onToggleScreenShare: () => void
  onOpenSettings: () => void
  unreadChat: number
}) {
  return (
    <>
      <Button
        size="icon"
        variant={isScreenShareEnabled ? 'default' : 'secondary'}
        className={cn('rounded-full', buttonClassName)}
        onClick={onToggleScreenShare}
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
        className={cn('rounded-full', buttonClassName)}
        onClick={onToggleHand}
        aria-label={handRaised ? 'Lower hand' : 'Raise hand'}
        aria-pressed={handRaised}
        title="Raise hand (Ctrl+Alt+H)"
      >
        <Hand className="size-4" />
      </Button>
      <ReactionPicker
        onReaction={onReaction}
        buttonClassName={buttonClassName}
      />
      <Button
        size="icon"
        variant={panel === 'people' ? 'default' : 'secondary'}
        className={cn('rounded-full', buttonClassName)}
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
        className={cn('relative rounded-full', buttonClassName)}
        onClick={() => onTogglePanel('chat')}
        aria-label={
          unreadChat > 0 ? `Toggle chat, ${unreadChat} unread` : 'Toggle chat'
        }
        aria-pressed={panel === 'chat'}
        title="Chat (Ctrl+Alt+C)"
      >
        <MessageSquare className="size-4" />
        {/*
          Chat now outlives the panel, so a message can arrive while it is
          closed. Without this the viewer has no way to know, which is what made
          the old bug look like a lost message. It is on the button itself at
          every width now that the phone no longer hides chat in a menu.
        */}
        {unreadChat > 0 ? <UnreadDot count={unreadChat} /> : null}
      </Button>
      <Button
        size="icon"
        variant="secondary"
        className={cn('rounded-full', buttonClassName)}
        onClick={onOpenSettings}
        aria-label="Settings"
      >
        <Settings className="size-4" />
      </Button>
    </>
  )
}

/**
 * The room code and its copy action, on a phone.
 *
 * All that is left of the old overflow menu: every control it used to hide now
 * has a button of its own in the row above. It stays a menu because the identity
 * block is text that needs ~200px, which is the one thing a 360px control line
 * genuinely cannot spare (ADR 0019 — the code is the join link).
 */
function DetailsMenu({
  className,
  roomName,
  eventContext,
  onCopyInvite,
}: {
  className?: string
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
          className={cn('rounded-full', className)}
          aria-label="Meeting details"
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-64">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <MeetingIdentity
            roomName={roomName}
            eventContext={eventContext}
            className="min-w-0 flex-1"
          />
          <Button
            size="icon"
            variant="ghost"
            className="size-9 shrink-0"
            onClick={onCopyInvite}
            aria-label="Copy invite link"
          >
            <LinkIcon className="size-4" />
          </Button>
        </div>
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
  buttonClassName,
}: {
  onReaction: (emoji: Reaction) => void
  buttonClassName?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="secondary"
          className={cn('rounded-full', buttonClassName)}
          aria-label="Send a reaction"
        >
          <Smile className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-1.5" align="center" side="top">
        {/* Each emoji is its own 44px target here too — this popover is now
            reachable in one tap on a phone, so it is a phone surface. */}
        <div className="flex gap-0.5">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="flex size-11 items-center justify-center rounded-md text-xl transition-transform hover:scale-110 hover:bg-accent sm:size-8"
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
