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
import { toast } from 'sonner'
import { cn } from '@zntr/utils'
import { isLowPowerDevice } from '@/lib/meet-utils'

type BackgroundEffect = 'none' | 'blur' | 'office' | 'mountains'

const BACKGROUND_IMAGES: Record<'office' | 'mountains', string> = {
  office: '/backgrounds/office.jpg',
  mountains: '/backgrounds/mountains.jpg',
}

/**
 * Confirms the background image decodes before a processor is built from it.
 *
 * BackgroundTransformer swallows its own image load failure — it catches and
 * console.errors, then carries on — so `setProcessor` resolves happily with a
 * processor that has no background. Clicking the option did nothing at all and
 * said nothing, which is exactly how two image options stayed broken while the
 * files in public/backgrounds were still git-lfs pointer stubs.
 */
async function imageIsUsable(url: string): Promise<boolean> {
  try {
    const image = new Image()
    image.crossOrigin = 'Anonymous'
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error(`cannot load ${url}`))
      image.src = url
    })
    return image.naturalWidth > 0
  } catch {
    return false
  }
}

/**
 * Which background is applied per camera track. LiveKit's processor only
 * reports its kind ("virtual-background"), not which image, so the dialog
 * would otherwise lose the selection every time it reopens.
 */
const appliedBackgrounds = new Map<string, BackgroundEffect>()

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

  // Reflect the currently applied processor when the dialog reopens. The
  // processor name cannot tell two virtual backgrounds apart, so the applied
  // choice is remembered per track id — otherwise reopening the dialog would
  // claim no background is active while one clearly is.
  useEffect(() => {
    if (!localVideoTrack) return
    const name = localVideoTrack.getProcessor()?.name
    if (name === 'background-blur') {
      setEffect('blur')
      return
    }
    if (name === 'virtual-background') {
      setEffect(appliedBackgrounds.get(localVideoTrack.sid ?? '') ?? 'office')
      return
    }
    setEffect('none')
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
        const url = BACKGROUND_IMAGES[next]
        if (!(await imageIsUsable(url))) {
          // Fall back rather than leave a processor that quietly does nothing.
          toast.error('That background image could not be loaded')
          return
        }
        await localVideoTrack.setProcessor(VirtualBackground(url))
      }
      if (localVideoTrack.sid) {
        appliedBackgrounds.set(localVideoTrack.sid, next)
      }
      setEffect(next)
    } catch {
      toast.error('That background effect is not supported on this device')
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
