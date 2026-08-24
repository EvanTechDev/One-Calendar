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
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@zntr/ui/button'
import { cn } from '@zntr/utils'
import { SettingsDialog } from '@/components/room/settings-dialog'

interface ControlBarProps {
  roomName: string
  chatOpen: boolean
  onToggleChat: () => void
}

export function ControlBar({
  roomName,
  chatOpen,
  onToggleChat,
}: ControlBarProps) {
  const room = useRoomContext()
  const {
    localParticipant,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
  } = useLocalParticipant()
  const [settingsOpen, setSettingsOpen] = useState(false)

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
            onClick={() => room.disconnect()}
            aria-label="Leave meeting"
          >
            <PhoneOff className="size-4" />
          </Button>
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
