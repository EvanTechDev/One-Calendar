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
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@zntr/ui/button'
import { cn } from '@zntr/utils'
import { SettingsDialog } from '@/components/room/settings-dialog'
import { getCreatorToken } from '@/lib/creator-token'

interface ControlBarProps {
  roomName: string
  chatOpen: boolean
  onToggleChat: () => void
  onLeaveIntent: () => void
}

export function ControlBar({
  roomName,
  chatOpen,
  onToggleChat,
  onLeaveIntent,
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
      <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
        <div className="hidden min-w-0 items-center gap-2 sm:flex">
          <span className="truncate text-sm text-muted-foreground">
            {roomName}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={copyInvite}
            aria-label="Copy invite link"
          >
            <LinkIcon className="size-3.5" />
          </Button>
        </div>

        <div className="flex flex-1 items-center justify-center gap-2">
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
            variant={chatOpen ? 'default' : 'secondary'}
            className="rounded-full"
            onClick={onToggleChat}
            aria-label="Toggle chat"
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

        <div className="hidden w-24 sm:block" />
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
