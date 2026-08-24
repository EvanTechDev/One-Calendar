'use client'

import { useEffect, useState } from 'react'
import {
  ParticipantEvent,
  RoomEvent,
  Track,
  VideoQuality,
} from 'livekit-client'
import type {
  LocalTrackPublication,
  RemoteTrackPublication,
  RemoteTrack,
  Room,
} from 'livekit-client'

function lowerRemoteQuality(room: Room) {
  for (const participant of room.remoteParticipants.values()) {
    for (const publication of participant.trackPublications.values()) {
      if (publication.kind === Track.Kind.Video) {
        ;(publication as RemoteTrackPublication).setVideoQuality(
          VideoQuality.LOW,
        )
      }
    }
  }
}

/**
 * Reacts to CPU-constrained local tracks by lowering published video
 * quality and forcing remote videos to their lowest simulcast layer.
 */
export function useLowCPUOptimizer(room: Room) {
  const [lowPowerMode, setLowPowerMode] = useState(false)

  useEffect(() => {
    const handleCpuConstrained = (track: unknown) => {
      setLowPowerMode(true)
      const localTrack = track as { prioritizePerformance?: () => void }
      localTrack.prioritizePerformance?.()
      lowerRemoteQuality(room)
    }
    room.localParticipant.on(
      ParticipantEvent.LocalTrackCpuConstrained,
      handleCpuConstrained,
    )
    return () => {
      room.localParticipant.off(
        ParticipantEvent.LocalTrackCpuConstrained,
        handleCpuConstrained,
      )
    }
  }, [room])

  useEffect(() => {
    if (!lowPowerMode) return
    const handleSubscribed = (
      _track: RemoteTrack,
      publication: RemoteTrackPublication,
    ) => {
      if (publication.kind === Track.Kind.Video) {
        publication.setVideoQuality(VideoQuality.LOW)
      }
    }
    room.on(RoomEvent.TrackSubscribed, handleSubscribed)
    return () => {
      room.off(RoomEvent.TrackSubscribed, handleSubscribed)
    }
  }, [room, lowPowerMode])

  return lowPowerMode
}

export type { LocalTrackPublication }
