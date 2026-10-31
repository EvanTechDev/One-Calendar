import { backgroundImageFor } from '@/lib/backgrounds'
import { isLowPowerDevice } from '@/lib/meet-utils'
import type { BackgroundEffect } from '@/lib/backgrounds'

/**
 * Applying the persisted join preferences to the tracks a freshly-connected
 * room just published.
 *
 * This file is the reason the dashboard's Preferences tab is honest. Krisp and
 * the background processors need a live track, which the dashboard has none of,
 * so the dialog stores a *choice* and this runs at the one moment a track
 * exists — right after connect, from active-room.tsx. Without it, the
 * preference would save and do nothing, which is worse than not offering it.
 *
 * Structural track types rather than livekit's: the only capabilities needed
 * are `setProcessor` and `getProcessor`, and depending on the concrete classes
 * would drag the whole SDK into anything that tests this.
 */

interface ProcessableTrack {
  setProcessor(processor: unknown): Promise<void>
  getProcessor(): { name: string } | undefined
}

export interface JoinPreferences {
  noiseFilterEnabled: boolean
  backgroundEffect: BackgroundEffect
}

export interface JoinTracks {
  /** The published microphone track, when the user joined unmuted. */
  audioTrack?: ProcessableTrack
  /** The published camera track, when the user joined with video on. */
  videoTrack?: ProcessableTrack
}

/**
 * Best-effort by design: an unsupported browser or a device that cannot run a
 * segmentation model must not stop the user joining. Each half is independent,
 * so a failed background does not cost the noise filter.
 */
export async function applyJoinPreferences(
  tracks: JoinTracks,
  preferences: JoinPreferences,
): Promise<void> {
  await Promise.all([
    applyNoiseFilter(tracks.audioTrack, preferences.noiseFilterEnabled),
    applyBackground(tracks.videoTrack, preferences.backgroundEffect),
  ])
}

async function applyNoiseFilter(
  track: ProcessableTrack | undefined,
  enabled: boolean,
): Promise<void> {
  if (!track || !enabled) return
  try {
    const { KrispNoiseFilter, isKrispNoiseFilterSupported } =
      await import('@livekit/krisp-noise-filter')
    // Krisp is a LiveKit Cloud feature and is unsupported on some browsers;
    // attaching it anyway throws inside the audio worklet.
    if (!isKrispNoiseFilterSupported()) return
    if (track.getProcessor()?.name === 'livekit-noise-filter') return
    await track.setProcessor(
      KrispNoiseFilter({ quality: isLowPowerDevice() ? 'low' : 'medium' }),
    )
  } catch {
    // Joining unfiltered is a far better outcome than not joining.
  }
}

async function applyBackground(
  track: ProcessableTrack | undefined,
  effect: BackgroundEffect,
): Promise<void> {
  if (!track || effect === 'none') return
  try {
    const { BackgroundBlur, VirtualBackground } =
      await import('@livekit/track-processors')
    if (effect === 'blur') {
      await track.setProcessor(BackgroundBlur(10))
      return
    }
    const url = backgroundImageFor(effect)
    if (!url) return
    // BackgroundTransformer catches its own image load failure and carries on,
    // so a processor built from a missing image resolves happily and shows
    // nothing. Confirm the image decodes first.
    if (!(await imageIsUsable(url))) return
    await track.setProcessor(VirtualBackground(url))
  } catch {
    // Same reasoning as above.
  }
}

/** Shared with the in-meeting dialog's check, for the same reason. */
export async function imageIsUsable(url: string): Promise<boolean> {
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
