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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@zntr/ui/sheet'
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

        Below `sm` the grid is off entirely and the bar is one flex row. A phone
        has no left region to centre against — it is hidden — so the grid there
        only cost the controls half the viewport for an empty third track.
      */}
      <div className="border-t">
        {/*
          One flex line on a phone, the three-track grid from `sm` up.

          Five targets on a phone: mic, camera, hand, More, Leave. The previous
          version put six more toggles on a second row of identical circles,
          which gave Settings the same visual weight as the microphone and spent
          112px of a 640px viewport saying so. Rarer controls now sit behind
          More, which is also where the room code lives.
        */}
        <div className="flex items-center gap-2 px-3 py-2.5 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:px-4 sm:py-3">
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

            {/*
              The one secondary control promoted to the phone's row: raising a
              hand is time-critical in a way that opening Settings is not, and
              two taps to interrupt is one too many.
            */}
            <Button
              size="icon"
              variant={handRaised ? 'default' : 'secondary'}
              className="size-11 rounded-full sm:size-8"
              onClick={onToggleHand}
              aria-label={handRaised ? 'Lower hand' : 'Raise hand'}
              aria-pressed={handRaised}
              title="Raise hand (Ctrl+Alt+H)"
            >
              <Hand className="size-4" />
            </Button>

            <div
              data-region="center-secondary"
              className="hidden items-center gap-2 sm:flex"
            >
              <SecondaryControls
                panel={panel}
                onTogglePanel={onTogglePanel}
                onReaction={onReaction}
                isScreenShareEnabled={isScreenShareEnabled}
                onToggleScreenShare={toggleScreenShare}
                onOpenSettings={() => setSettingsOpen(true)}
                unreadChat={unreadChat}
              />
            </div>

            <MoreSheet
              className="size-11 sm:hidden"
              roomName={roomName}
              eventContext={eventContext}
              onCopyInvite={copyInvite}
              panel={panel}
              onTogglePanel={onTogglePanel}
              onReaction={onReaction}
              isScreenShareEnabled={isScreenShareEnabled}
              onToggleScreenShare={toggleScreenShare}
              onOpenSettings={() => setSettingsOpen(true)}
              unreadChat={unreadChat}
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
  onReaction,
  isScreenShareEnabled,
  onToggleScreenShare,
  onOpenSettings,
  unreadChat,
}: {
  /** Sizing for the phone sheet; the desktop cluster keeps the default. */
  buttonClassName?: string
  panel: 'chat' | 'people' | null
  onTogglePanel: (panel: 'chat' | 'people') => void
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
 * Everything a phone's control row does not have space to show: the room code,
 * and the toggles that are not time-critical.
 *
 * A bottom sheet rather than a dropdown menu because these are one-tap controls
 * with state, not menu commands — a sheet can lay them out as a labelled grid,
 * which is what gives them the hierarchy six identical circles on a second row
 * did not have. Each label also says what the icon meant, which a bare circle
 * never did.
 *
 * The room code is here for the same reason it was in the old menu: the identity
 * block is text that needs ~200px, the one thing a 360px control line genuinely
 * cannot spare (ADR 0019 — the code is the join link).
 */
function MoreSheet({
  className,
  roomName,
  eventContext,
  onCopyInvite,
  panel,
  onTogglePanel,
  onReaction,
  isScreenShareEnabled,
  onToggleScreenShare,
  onOpenSettings,
  unreadChat,
}: {
  className?: string
  roomName: string
  eventContext?: RoomEventContext
  onCopyInvite: () => void
  panel: 'chat' | 'people' | null
  onTogglePanel: (panel: 'chat' | 'people') => void
  onReaction: (emoji: Reaction) => void
  isScreenShareEnabled: boolean
  onToggleScreenShare: () => void
  onOpenSettings: () => void
  unreadChat: number
}) {
  const [open, setOpen] = useState(false)

  // Opening a panel or the settings dialog has to close this first: both render
  // behind it, so leaving the sheet up would hide what the tap just opened.
  const closeThen = (action: () => void) => () => {
    setOpen(false)
    action()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          variant="secondary"
          className={cn('relative rounded-full', className)}
          aria-label={
            unreadChat > 0 ? `More, ${unreadChat} unread messages` : 'More'
          }
        >
          <MoreVertical className="size-4" />
          {/* Chat lives in here on a phone, so its badge has to surface on the
              trigger or an arriving message is invisible. */}
          {unreadChat > 0 ? <UnreadDot count={unreadChat} /> : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="gap-0 pb-8">
        <SheetHeader className="flex-row items-center gap-2 border-b pb-3">
          <SheetTitle className="sr-only">Meeting controls</SheetTitle>
          <MeetingIdentity
            roomName={roomName}
            eventContext={eventContext}
            className="min-w-0 flex-1"
          />
          <Button
            size="icon"
            variant="ghost"
            className="size-11 shrink-0"
            onClick={onCopyInvite}
            aria-label="Copy invite link"
          >
            <LinkIcon className="size-4" />
          </Button>
        </SheetHeader>

        <div className="grid grid-cols-4 gap-2 pt-4">
          <SheetAction
            label={isScreenShareEnabled ? 'Stop share' : 'Share'}
            active={isScreenShareEnabled}
            onClick={closeThen(onToggleScreenShare)}
            icon={
              isScreenShareEnabled ? (
                <MonitorX className="size-5" />
              ) : (
                <MonitorUp className="size-5" />
              )
            }
          />
          <SheetAction
            label="People"
            active={panel === 'people'}
            onClick={closeThen(() => onTogglePanel('people'))}
            icon={<Users className="size-5" />}
          />
          <SheetAction
            label="Chat"
            active={panel === 'chat'}
            badge={unreadChat}
            onClick={closeThen(() => onTogglePanel('chat'))}
            icon={<MessageSquare className="size-5" />}
          />
          <SheetAction
            label="Settings"
            onClick={closeThen(onOpenSettings)}
            icon={<Settings className="size-5" />}
          />
        </div>

        <div className="mt-4 border-t pt-4">
          <span className="text-xs font-medium text-muted-foreground">
            Send a reaction
          </span>
          <div className="mt-2 flex justify-between">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                // Reactions stay open: sending several in a row is the normal
                // way they are used, and closing after one would fight that.
                onClick={() => onReaction(emoji)}
                className="flex size-11 items-center justify-center rounded-md text-2xl transition-transform hover:scale-110 hover:bg-accent"
                aria-label={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/**
 * One labelled control in the sheet's grid. The label is the point: a circle
 * with an icon says nothing about what it does until you tap it.
 */
function SheetAction({
  label,
  icon,
  onClick,
  active,
  badge,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  active?: boolean
  badge?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-lg px-1 py-2.5 transition-colors',
        active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
      )}
    >
      <span className="relative flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        {icon}
        {badge && badge > 0 ? <UnreadDot count={badge} /> : null}
      </span>
      <span className="text-xs leading-none">{label}</span>
    </button>
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
