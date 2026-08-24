'use client'

import { useEffect, useMemo, useState } from 'react'
import { Track } from 'livekit-client'
import type { LocalVideoTrack } from 'livekit-client'
import {
  useLocalParticipant,
  useMediaDeviceSelect,
} from '@livekit/components-react'
import { useKrispNoiseFilter } from '@livekit/components-react/krisp'
import { BackgroundBlur, VirtualBackground } from '@livekit/track-processors'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@zntr/ui/dialog'
import { Label } from '@zntr/ui/label'
import { Switch } from '@zntr/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@zntr/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@zntr/ui/tabs'
import { cn } from '@zntr/utils'
import { isLowPowerDevice } from '@/lib/meet-utils'

type BackgroundEffect = 'none' | 'blur' | 'office' | 'mountains'

const BACKGROUND_IMAGES: Record<'office' | 'mountains', string> = {
  office: '/backgrounds/office.jpg',
  mountains: '/backgrounds/mountains.jpg',
}

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="video">
          <TabsList className="w-full">
            <TabsTrigger value="video" className="flex-1">
              Video
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex-1">
              Audio
            </TabsTrigger>
          </TabsList>
          <TabsContent value="video" className="space-y-4 pt-2">
            <DeviceSection kind="videoinput" label="Camera" />
            <BackgroundEffects />
          </TabsContent>
          <TabsContent value="audio" className="space-y-4 pt-2">
            <DeviceSection kind="audioinput" label="Microphone" />
            <DeviceSection kind="audiooutput" label="Speaker" />
            <NoiseFilterSection />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function DeviceSection({
  kind,
  label,
}: {
  kind: MediaDeviceKind
  label: string
}) {
  const { devices, activeDeviceId, setActiveMediaDevice } =
    useMediaDeviceSelect({ kind })

  if (devices.length === 0) return null

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={activeDeviceId}
        onValueChange={(deviceId) => setActiveMediaDevice(deviceId)}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {devices.map((device) => (
            <SelectItem key={device.deviceId} value={device.deviceId}>
              {device.label || `${label} ${device.deviceId.slice(0, 6)}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function BackgroundEffects() {
  const { cameraTrack } = useLocalParticipant()
  const [effect, setEffect] = useState<BackgroundEffect>('none')
  const [applying, setApplying] = useState(false)

  const localVideoTrack = useMemo(() => {
    if (
      cameraTrack &&
      cameraTrack.source === Track.Source.Camera &&
      cameraTrack.track
    ) {
      return cameraTrack.track as LocalVideoTrack
    }
    return undefined
  }, [cameraTrack])

  // Reflect the currently applied processor when the dialog reopens.
  useEffect(() => {
    const name = localVideoTrack?.getProcessor()?.name
    if (name === 'background-blur') setEffect('blur')
    else if (name !== 'virtual-background') setEffect('none')
  }, [localVideoTrack])

  const applyEffect = async (next: BackgroundEffect) => {
    if (!localVideoTrack || applying) return
    setApplying(true)
    try {
      if (next === 'none') {
        await localVideoTrack.stopProcessor()
      } else if (next === 'blur') {
        await localVideoTrack.setProcessor(BackgroundBlur(10))
      } else {
        await localVideoTrack.setProcessor(
          VirtualBackground(BACKGROUND_IMAGES[next]),
        )
      }
      setEffect(next)
    } finally {
      setApplying(false)
    }
  }

  if (!localVideoTrack) return null

  return (
    <div className="space-y-2">
      <Label>Background</Label>
      <div className="grid grid-cols-4 gap-2">
        <EffectButton
          label="None"
          selected={effect === 'none'}
          disabled={applying}
          onClick={() => applyEffect('none')}
        />
        <EffectButton
          label="Blur"
          selected={effect === 'blur'}
          disabled={applying}
          onClick={() => applyEffect('blur')}
        />
        <EffectButton
          label="Office"
          selected={effect === 'office'}
          disabled={applying}
          onClick={() => applyEffect('office')}
          imageUrl={BACKGROUND_IMAGES.office}
        />
        <EffectButton
          label="Peaks"
          selected={effect === 'mountains'}
          disabled={applying}
          onClick={() => applyEffect('mountains')}
          imageUrl={BACKGROUND_IMAGES.mountains}
        />
      </div>
    </div>
  )
}

function EffectButton({
  label,
  selected,
  disabled,
  onClick,
  imageUrl,
}: {
  label: string
  selected: boolean
  disabled: boolean
  onClick: () => void
  imageUrl?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex aspect-video items-end justify-center overflow-hidden rounded-md border bg-muted bg-cover bg-center pb-1 text-xs transition-colors',
        selected && 'border-primary ring-1 ring-primary',
        disabled && 'opacity-50',
      )}
      style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
      aria-pressed={selected}
    >
      <span className="rounded bg-black/50 px-1 text-white">{label}</span>
    </button>
  )
}

function NoiseFilterSection() {
  const { isNoiseFilterEnabled, setNoiseFilterEnabled, isNoiseFilterPending } =
    useKrispNoiseFilter({
      filterOptions: {
        quality: isLowPowerDevice() ? 'low' : 'medium',
      },
    })

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label htmlFor="noise-filter">Noise cancellation</Label>
        <p className="text-xs text-muted-foreground">
          Suppress background noise with Krisp
        </p>
      </div>
      <Switch
        id="noise-filter"
        checked={isNoiseFilterEnabled}
        disabled={isNoiseFilterPending}
        onCheckedChange={(checked) => setNoiseFilterEnabled(checked)}
      />
    </div>
  )
}
