'use client'

import { useEffect, useState } from 'react'
import { facingModeFromLocalTrack, isLocalTrack } from 'livekit-client'
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react'

/**
 * Whether your own video should be drawn mirrored.
 *
 * Mirroring exists for the intuition of watching yourself: a front camera is
 * the closest thing to a mirror, so a flip is what makes raising your right hand
 * look right. A rear camera points at the world, where flipping only reverses
 * it — text behind the phone comes out backwards. The old rule tested
 * `isLocal` alone and mirrored both.
 *
 * Local only, and CSS only. A remote viewer must keep seeing true sensor
 * orientation: A's right hand appearing on the left of B's screen is what two
 * people standing face to face look like.
 */
export function useMirrorLocalVideo(
  trackRef: TrackReferenceOrPlaceholder,
  isScreenShare: boolean,
): boolean {
  const track = trackRef.publication?.track
  const isLocal = trackRef.participant.isLocal
  // Default to mirrored for a camera whose facing mode is not yet known:
  // `facingModeFromLocalTrack` falls back to 'user', and a laptop webcam — the
  // common case — is user-facing.
  const [mirrored, setMirrored] = useState(isLocal && !isScreenShare)

  useEffect(() => {
    if (!isLocal || isScreenShare) {
      setMirrored(false)
      return
    }
    if (!track || !isLocalTrack(track)) return

    const read = () => {
      // Browsers do not agree on exposing facingMode, so the SDK falls back to
      // reading the device label. Its own docs call the result "probable" —
      // hence the confidence field, which is why a wrong guess here is a
      // cosmetic flip rather than a broken call.
      const { facingMode } = facingModeFromLocalTrack(track)
      setMirrored(facingMode === 'user')
    }

    read()
    // Switching between front and rear cameras replaces the underlying
    // MediaStreamTrack without remounting the tile, so a value read once at
    // mount would keep mirroring a rear camera.
    track.on('restarted', read)
    return () => {
      track.off('restarted', read)
    }
  }, [track, isLocal, isScreenShare])

  return mirrored
}
