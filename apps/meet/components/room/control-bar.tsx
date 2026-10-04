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
  Ellipsis,
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
  SheetDescription,
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
      {/* Equal desktop side tracks keep the controls centred for either role.
          On phones, host actions live in More so all five labelled targets fit. */}
      <div className="shrink-0 border-t bg-background pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
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

          <div
            data-region="center"
            className="mx-auto flex max-w-md flex-1 items-center justify-center gap-2 sm:max-w-none sm:flex-none"
          >
            <ControlButton
              active={isMicrophoneEnabled}
              onClick={() =>
                localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
              }
              label={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
              caption={isMicrophoneEnabled ? 'Mic on' : 'Mic off'}
              onIcon={<Mic className="size-5 sm:size-4" />}
              offIcon={<MicOff className="size-5 sm:size-4" />}
            />
            <ControlButton
              active={isCameraEnabled}
              onClick={() =>
                localParticipant.setCameraEnabled(!isCameraEnabled)
              }
              label={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
              caption={isCameraEnabled ? 'Cam on' : 'Cam off'}
              onIcon={<Video className="size-5 sm:size-4" />}
              offIcon={<VideoOff className="size-5 sm:size-4" />}
            />

            {/*
              The one secondary control promoted to the phone's row: raising a
              hand is time-critical in a way that opening Settings is not, and
              two taps to interrupt is one too many.
            */}
            <Button
              size="icon"
              variant={handRaised ? 'default' : 'secondary'}
              className="size-12 h-16 flex-col gap-1.5 rounded-2xl sm:size-8 sm:rounded-full"
              onClick={onToggleHand}
              aria-label={handRaised ? 'Lower hand' : 'Raise hand'}
              aria-pressed={handRaised}
              title="Raise hand (Ctrl+Alt+H)"
            >
              <Hand className="size-5 sm:size-4" />
              <span
                aria-hidden="true"
                className="text-[10px] leading-none sm:hidden"
              >
                {handRaised ? 'Lower' : 'Raise'}
              </span>
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
              className="size-12 h-16 flex-col gap-1.5 rounded-2xl sm:hidden"
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
              isOrganiser={isOrganiser}
              ending={ending}
              onEndForAll={endForAll}
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
              className="ml-4 size-12 h-16 flex-col gap-1.5 rounded-2xl bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive dark:text-background dark:hover:bg-destructive/90 sm:ml-0 sm:size-8 sm:rounded-full"
              onClick={() => {
                onLeaveIntent()
                room.disconnect()
              }}
              aria-label="Leave meeting"
            >
              <PhoneOff className="size-5 sm:size-4" />
              <span
                aria-hidden="true"
                className="text-[10px] leading-none sm:hidden"
              >
                Leave
              </span>
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
            className="hidden min-w-0 items-center justify-end gap-2 sm:flex"
          >
            {isOrganiser ? (
              <Button
                variant="destructive"
                size="icon"
                // `size="icon"` carries no gap (it is square by definition), so
                // widening it for a label leaves the icon touching the text.
                // 1.5 is what every non-icon size in @zntr/ui/button uses.
                className="size-8 w-auto gap-1.5 rounded-full px-4"
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
  caption,
  onIcon,
  offIcon,
}: {
  active: boolean
  onClick: () => void
  label: string
  caption: string
  onIcon: React.ReactNode
  offIcon: React.ReactNode
}) {
  return (
    <Button
      size="icon"
      variant={active ? 'secondary' : 'destructive'}
      className="size-12 h-16 flex-col gap-1.5 rounded-2xl sm:size-8 sm:rounded-full"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      {active ? onIcon : offIcon}
      <span aria-hidden="true" className="text-[10px] leading-none sm:hidden">
        {caption}
      </span>
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
 * Desktop secondary controls. The mobile sheet uses labelled actions below.
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
        {/* The More trigger surfaces this same unread count on mobile. */}
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
  isOrganiser,
  ending,
  onEndForAll,
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
  isOrganiser: boolean
  ending: boolean
  onEndForAll: () => void
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
          <Ellipsis className="size-5" />
          <span aria-hidden="true" className="text-[10px] leading-none">
            More
          </span>
          {/* Chat lives in here on a phone, so its badge has to surface on the
              trigger or an arriving message is invisible. */}
          {unreadChat > 0 ? <UnreadDot count={unreadChat} /> : null}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-3xl pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] motion-reduce:animate-none [&>*]:shrink-0 [&_[data-slot=sheet-close]]:size-11"
      >
        <SheetHeader className="gap-1 border-b px-0 pb-4 pr-10 pt-5">
          <SheetTitle className="text-lg font-semibold">
            Meeting controls
          </SheetTitle>
          <SheetDescription>
            People, messages, and room settings.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
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
        </div>

        <div className="grid grid-cols-4 gap-2 pt-5">
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

        <div className="mt-5 border-t pt-4">
          <span className="text-xs font-medium text-muted-foreground">
            Send a reaction
          </span>
          <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-muted/50 p-1.5 min-[360px]:grid-cols-6">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                // Reactions stay open: sending several in a row is the normal
                // way they are used, and closing after one would fight that.
                onClick={() => onReaction(emoji)}
                className="flex min-h-11 min-w-0 items-center justify-center rounded-xl text-2xl transition-transform hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring motion-safe:hover:scale-110"
                aria-label={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
        {isOrganiser ? (
          <div className="mt-5 border-t pt-4">
            <Button
              variant="destructive"
              className="h-12 w-full justify-start gap-3 rounded-xl px-4"
              onClick={closeThen(onEndForAll)}
              disabled={ending}
              aria-label="End meeting for all"
            >
              <CircleSlash className="size-4" />
              {ending ? 'Ending…' : 'End for all'}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              This closes the room for everyone.
            </p>
          </div>
        ) : null}
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
        'flex min-h-20 min-w-0 flex-col items-center gap-2 rounded-2xl border px-1 py-3 transition-colors focus-visible:outline-2 focus-visible:outline-ring',
        active
          ? 'border-meet-accent/30 bg-meet-tint text-meet-accent'
          : 'border-transparent bg-muted/50 hover:bg-muted',
      )}
    >
      <span className="relative flex size-8 items-center justify-center">
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
