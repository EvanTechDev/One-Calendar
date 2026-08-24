'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DeviceUnsupportedError,
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
import type { ConnectionDetails, RoomPageOptions } from '@/lib/types'
import type { UserChoices } from '@/lib/user-choices'

interface ActiveRoomProps {
  connectionDetails: ConnectionDetails
  userChoices: UserChoices
  options: RoomPageOptions
}

export function ActiveRoom({
  connectionDetails,
  userChoices,
  options,
}: ActiveRoomProps) {
  const router = useRouter()
  const e2ee = useE2EE()
  const [e2eeReady, setE2eeReady] = useState(!e2ee.enabled)

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
        if (error instanceof DeviceUnsupportedError) {
          toast.error(
            'Your browser does not support encrypted meetings. Please update to the latest version.',
          )
        } else {
          toast.error('Failed to set up encryption')
        }
      })
    return () => {
      cancelled = true
    }
  }, [room, e2ee])

  // Connect once E2EE (if any) is ready.
  useEffect(() => {
    if (!e2eeReady) return

    const handleDisconnect = () => router.push('/')
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
        {
          autoSubscribe: true,
        },
      )
      .then(() => {
        if (userChoices.videoEnabled) {
          room.localParticipant.setCameraEnabled(true)
        }
        if (userChoices.audioEnabled) {
          room.localParticipant.setMicrophoneEnabled(true)
        }
      })
      .catch((error) => {
        toast.error(`Failed to connect: ${error.message}`)
      })

    return () => {
      room.off(RoomEvent.Disconnected, handleDisconnect)
      room.off(RoomEvent.MediaDevicesError, handleMediaError)
      room.off(RoomEvent.EncryptionError, handleEncryptionError)
      room.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e2eeReady])

  const lowPowerMode = useLowCPUOptimizer(room)

  useEffect(() => {
    if (lowPowerMode) {
      toast.warning('Low power mode enabled — video quality reduced')
    }
  }, [lowPowerMode])

  return (
    <RoomContext.Provider value={room}>
      <MeetingRoom roomName={connectionDetails.roomName} />
    </RoomContext.Provider>
  )
}
