'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DeviceUnsupportedError,
  DisconnectReason,
  Room,
  RoomEvent,
  VideoPresets,
} from 'livekit-client'
import type { RoomOptions, VideoCodec } from 'livekit-client'
import { RoomContext } from '@livekit/components-react'
import { toast } from 'sonner'
import { useE2EE } from '@/hooks/use-e2ee'
import { useLowCPUOptimizer } from '@/hooks/use-low-cpu-optimizer'
import { MeetingRoom } from '@/components/room/meeting-room'
import { RoomFailure } from '@/components/room/room-failure'
import type { RoomEventContext } from '@/lib/event-context'
import type { ConnectionDetails, RoomPageOptions } from '@/lib/types'
import type { UserChoices } from '@/lib/user-choices'

interface ActiveRoomProps {
  connectionDetails: ConnectionDetails
  userChoices: UserChoices
  options: RoomPageOptions
  onRetry: () => void
  eventContext?: RoomEventContext
}

type Phase =
  | { state: 'connecting' }
  | { state: 'connected' }
  | { state: 'failed'; message: string }
  | { state: 'dropped'; message: string }

const DAMAGED_LINK_MESSAGE =
  'This invite link is damaged, so its encryption key could not be read. Ask the organiser for a fresh link.'
const UNSUPPORTED_E2EE_MESSAGE =
  'This browser cannot join encrypted meetings. Update it, or ask for an unencrypted meeting.'

export function ActiveRoom({
  connectionDetails,
  userChoices,
  options,
  onRetry,
  eventContext,
}: ActiveRoomProps) {
  const router = useRouter()
  const e2ee = useE2EE()
  const [phase, setPhase] = useState<Phase>(() => {
    if (!e2ee.error) return { state: 'connecting' }
    // Two different failures, two different remedies: a damaged link needs a
    // fresh one from the organiser, whereas a browser that cannot start the
    // crypto worker needs updating — telling that user their link is broken
    // sends them to ask for a replacement that will fail identically.
    return {
      state: 'failed',
      message:
        e2ee.error === 'worker-unavailable'
          ? UNSUPPORTED_E2EE_MESSAGE
          : DAMAGED_LINK_MESSAGE,
    }
  })
  const [e2eeReady, setE2eeReady] = useState(!e2ee.enabled && !e2ee.error)
  /** Set when the local user chose to leave, so the drop screen is skipped. */
  const leavingRef = useRef(false)

  const room = useMemo(() => {
    // E2EE is incompatible with av1/vp9; let livekit pick a default there.
    let videoCodec: VideoCodec | undefined = options.codec
    if (e2ee.enabled && (videoCodec === 'av1' || videoCodec === 'vp9')) {
      videoCodec = undefined
    }

    const roomOptions: RoomOptions = {
      videoCaptureDefaults: {
        deviceId: userChoices.videoDeviceId,
        resolution: options.hq ? VideoPresets.h2160 : VideoPresets.h720,
      },
      audioCaptureDefaults: {
        deviceId: userChoices.audioDeviceId,
      },
      publishDefaults: {
        dtx: false,
        red: !e2ee.enabled,
        videoCodec,
        videoSimulcastLayers: options.hq
          ? [VideoPresets.h1080, VideoPresets.h720]
          : [VideoPresets.h540, VideoPresets.h216],
      },
      adaptiveStream: true,
      dynacast: true,
      e2ee:
        e2ee.enabled && e2ee.keyProvider && e2ee.worker
          ? { keyProvider: e2ee.keyProvider, worker: e2ee.worker }
          : undefined,
    }
    return new Room(roomOptions)
    // The room is created exactly once; options are frozen at first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Set up encryption keys before connecting.
  useEffect(() => {
    if (!e2ee.enabled || !e2ee.keyProvider || !e2ee.passphrase) return
    let cancelled = false
    e2ee.keyProvider
      .setKey(e2ee.passphrase)
      .then(() => room.setE2EEEnabled(true))
      .then(() => {
        if (!cancelled) setE2eeReady(true)
      })
      .catch((error) => {
        if (cancelled) return
        setPhase({
          state: 'failed',
          message:
            error instanceof DeviceUnsupportedError
              ? UNSUPPORTED_E2EE_MESSAGE
              : 'Encryption could not be set up for this meeting.',
        })
      })
    return () => {
      cancelled = true
    }
  }, [room, e2ee])

  // Connect once E2EE (if any) is ready.
  useEffect(() => {
    if (!e2eeReady) return
    let cancelled = false

    const handleDisconnect = (reason?: DisconnectReason) => {
      if (leavingRef.current) {
        router.push('/')
        return
      }
      if (reason === DisconnectReason.ROOM_DELETED) {
        setPhase({
          state: 'dropped',
          message: 'The organiser ended this meeting.',
        })
        return
      }
      if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
        setPhase({
          state: 'dropped',
          message: 'You joined this meeting from another tab or device.',
        })
        return
      }
      setPhase({
        state: 'dropped',
        message: 'You were disconnected from this meeting.',
      })
    }
    const handleMediaError = (error: Error) => {
      toast.error(`Media device error: ${error.message}`)
    }
    const handleEncryptionError = (error: Error) => {
      toast.error(`Encryption error: ${error.message}`)
    }

    room.on(RoomEvent.Disconnected, handleDisconnect)
    room.on(RoomEvent.MediaDevicesError, handleMediaError)
    room.on(RoomEvent.EncryptionError, handleEncryptionError)

    room
      .connect(
        connectionDetails.serverUrl,
        connectionDetails.participantToken,
        { autoSubscribe: true },
      )
      .then(() => {
        if (cancelled) return
        setPhase({ state: 'connected' })
        if (userChoices.videoEnabled) {
          room.localParticipant
            .setCameraEnabled(true)
            .catch(() => toast.error('Could not start your camera'))
        }
        if (userChoices.audioEnabled) {
          room.localParticipant
            .setMicrophoneEnabled(true)
            .catch(() => toast.error('Could not start your microphone'))
        }
      })
      .catch((error: Error) => {
        if (cancelled) return
        setPhase({
          state: 'failed',
          message: error.message || 'Could not connect to this meeting.',
        })
      })

    return () => {
      cancelled = true
      room.off(RoomEvent.Disconnected, handleDisconnect)
      room.off(RoomEvent.MediaDevicesError, handleMediaError)
      room.off(RoomEvent.EncryptionError, handleEncryptionError)
      room.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e2eeReady])

  // Release the crypto worker once the room is torn down.
  useEffect(() => {
    const worker = e2ee.worker
    return () => {
      worker?.terminate()
    }
  }, [e2ee.worker])

  const lowPowerMode = useLowCPUOptimizer(room)

  useEffect(() => {
    if (lowPowerMode) {
      toast.warning('Low power mode enabled — video quality reduced')
    }
  }, [lowPowerMode])

  const markLeaving = useCallback(() => {
    leavingRef.current = true
  }, [])

  if (phase.state === 'failed' || phase.state === 'dropped') {
    return (
      <RoomFailure
        message={phase.message}
        // A dropped connection is retryable; a damaged link is not.
        onRetry={phase.state === 'dropped' ? onRetry : undefined}
      />
    )
  }

  return (
    <RoomContext.Provider value={room}>
      <MeetingRoom
        roomName={connectionDetails.roomName}
        onLeaveIntent={markLeaving}
        retainChat={!e2ee.enabled}
        eventContext={eventContext}
        participantToken={connectionDetails.participantToken}
      />
    </RoomContext.Provider>
  )
}
