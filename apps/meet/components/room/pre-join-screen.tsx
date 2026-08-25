'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Video, VideoOff, Lock } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { Input } from '@zntr/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@zntr/ui/select'
import { cn } from '@zntr/utils'
import {
  defaultUserChoices,
  loadUserChoices,
  saveUserChoices,
} from '@/lib/user-choices'
import { MeetingWhen } from '@/components/room/meeting-identity'
import { MicLevel } from '@/components/room/mic-level'
import type { RoomEventContext } from '@/lib/event-context'
import type { UserChoices } from '@/lib/user-choices'

interface PreJoinScreenProps {
  roomName: string
  defaultUsername?: string
  error?: string
  /** The calendar event this room belongs to, when it has one. */
  eventContext?: RoomEventContext
  onJoin: (choices: UserChoices) => Promise<void>
}

export function PreJoinScreen({
  roomName,
  defaultUsername,
  error,
  eventContext,
  onJoin,
}: PreJoinScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [username, setUsername] = useState('')
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [videoDeviceId, setVideoDeviceId] = useState<string>()
  const [audioDeviceId, setAudioDeviceId] = useState<string>()
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [joining, setJoining] = useState(false)
  const [isE2ee, setIsE2ee] = useState(false)
  const [deviceNotice, setDeviceNotice] = useState<string>()
  /**
   * The join preferences this screen shows no control for — noise cancellation
   * and camera background, set in the dashboard's Preferences tab. Held so
   * `handleJoin` can hand them to ActiveRoom, which applies them once the
   * tracks exist. Dropping them here is what would make those settings save
   * and do nothing.
   */
  const [passThrough, setPassThrough] = useState({
    noiseFilterEnabled: defaultUserChoices.noiseFilterEnabled,
    backgroundEffect: defaultUserChoices.backgroundEffect,
  })

  // Restore saved choices once on mount.
  useEffect(() => {
    const saved = loadUserChoices()
    setUsername(defaultUsername || saved.username)
    setVideoEnabled(saved.videoEnabled)
    setAudioEnabled(saved.audioEnabled)
    setVideoDeviceId(saved.videoDeviceId)
    setAudioDeviceId(saved.audioDeviceId)
    setPassThrough({
      noiseFilterEnabled: saved.noiseFilterEnabled,
      backgroundEffect: saved.backgroundEffect,
    })
    setIsE2ee(window.location.hash.length > 1)
  }, [defaultUsername])

  // Device lists are refreshed independently of the camera preview, so an
  // audio-only joiner can still pick a microphone.
  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        if (cancelled) return
        setVideoDevices(devices.filter((d) => d.kind === 'videoinput'))
        setAudioDevices(devices.filter((d) => d.kind === 'audioinput'))
      } catch {
        // Enumeration is best-effort; the join flow does not depend on it.
      }
    }
    refresh()
    navigator.mediaDevices.addEventListener('devicechange', refresh)
    return () => {
      cancelled = true
      navigator.mediaDevices.removeEventListener('devicechange', refresh)
    }
  }, [])

  // Camera preview lifecycle.
  useEffect(() => {
    let cancelled = false
    const stopStream = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (!videoEnabled) {
      stopStream()
      return
    }

    navigator.mediaDevices
      .getUserMedia({
        video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        stopStream()
        streamRef.current = stream
        setDeviceNotice(undefined)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        // Labels only arrive once permission is granted.
        navigator.mediaDevices.enumerateDevices().then((devices) => {
          if (cancelled) return
          setVideoDevices(devices.filter((d) => d.kind === 'videoinput'))
          setAudioDevices(devices.filter((d) => d.kind === 'audioinput'))
        })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        // A silent toggle flip is indistinguishable from a user choice, so
        // say what actually happened.
        const name = error instanceof Error ? error.name : ''
        setDeviceNotice(
          name === 'NotAllowedError'
            ? 'Camera permission denied. Allow it in your browser settings to show video.'
            : name === 'NotFoundError'
              ? 'No camera found on this device.'
              : 'Your camera could not be started.',
        )
        setVideoEnabled(false)
      })

    return () => {
      cancelled = true
      stopStream()
    }
  }, [videoEnabled, videoDeviceId])

  const handleJoin = async () => {
    const choices: UserChoices = {
      username: username.trim(),
      videoEnabled,
      audioEnabled,
      videoDeviceId,
      audioDeviceId,
      ...passThrough,
    }
    // A merging write, so the fields this screen does not own survive.
    saveUserChoices(choices)
    setJoining(true)
    try {
      await onJoin(choices)
    } finally {
      setJoining(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-4xl gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
            {videoEnabled ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="size-full -scale-x-100 object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <VideoOff className="size-10" />
              </div>
            )}
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
              <Button
                size="icon"
                variant={audioEnabled ? 'secondary' : 'destructive'}
                className="rounded-full"
                onClick={() => setAudioEnabled((v) => !v)}
                aria-label={
                  audioEnabled ? 'Mute microphone' : 'Unmute microphone'
                }
              >
                {audioEnabled ? (
                  <Mic className="size-4" />
                ) : (
                  <MicOff className="size-4" />
                )}
              </Button>
              <Button
                size="icon"
                variant={videoEnabled ? 'secondary' : 'destructive'}
                className="rounded-full"
                onClick={() => setVideoEnabled((v) => !v)}
                aria-label={videoEnabled ? 'Turn camera off' : 'Turn camera on'}
              >
                {videoEnabled ? (
                  <Video className="size-4" />
                ) : (
                  <VideoOff className="size-4" />
                )}
              </Button>
            </div>
          </div>
          <MicLevel deviceId={audioDeviceId} enabled={audioEnabled} />
          {deviceNotice ? (
            <p className="text-sm text-muted-foreground">{deviceNotice}</p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <DeviceSelect
              devices={videoDevices}
              value={videoDeviceId}
              placeholder="Camera"
              onChange={setVideoDeviceId}
            />
            <DeviceSelect
              devices={audioDevices}
              value={audioDeviceId}
              placeholder="Microphone"
              onChange={setAudioDeviceId}
            />
          </div>
        </div>

        <div className="flex flex-col justify-center space-y-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">
              {eventContext ? eventContext.title : 'Ready to join?'}
            </h1>
            {eventContext ? <MeetingWhen eventContext={eventContext} /> : null}
            <p
              className={cn(
                'flex items-center gap-1.5 text-sm text-muted-foreground',
              )}
            >
              {isE2ee ? <Lock className="size-3.5" /> : null}
              {eventContext ? 'Meeting' : 'Room'} {roomName}
              {isE2ee ? ' · encrypted' : ''}
            </p>
            {/* Say plainly what happens to chat either way (ADR 0020). */}
            <p className="text-xs text-muted-foreground">
              {isE2ee
                ? 'End-to-end encrypted. Chat is not saved.'
                : 'Chat messages are saved for this meeting.'}
            </p>
          </div>
          <Input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Your name"
            aria-label="Your name"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && username.trim() && !joining) {
                handleJoin()
              }
            }}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            size="lg"
            disabled={!username.trim() || joining}
            onClick={handleJoin}
          >
            {joining ? 'Joining…' : 'Join meeting'}
          </Button>
        </div>
      </div>
    </main>
  )
}

function DeviceSelect({
  devices,
  value,
  placeholder,
  onChange,
}: {
  devices: MediaDeviceInfo[]
  value?: string
  placeholder: string
  onChange: (deviceId: string) => void
}) {
  if (devices.length === 0) return null
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {devices.map((device) => (
          <SelectItem key={device.deviceId} value={device.deviceId}>
            {device.label || `${placeholder} ${device.deviceId.slice(0, 6)}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
