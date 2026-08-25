import { isBackgroundEffect } from '@/lib/backgrounds'
import type { BackgroundEffect } from '@/lib/backgrounds'

/**
 * Everything the join path needs to know about how this browser likes to join.
 *
 * ONE store, deliberately. The dashboard's Preferences tab and the PreJoin
 * screen both write "am I muted on join" and "is my camera on"; two stores
 * would mean two answers to a question that has exactly one, and the loser
 * would be whichever screen was used last. So the dialog writes here and
 * PreJoin reads here — see `applyJoinPreferences` for the media side.
 */
export interface UserChoices {
  username: string
  videoEnabled: boolean
  audioEnabled: boolean
  videoDeviceId?: string
  audioDeviceId?: string
  /**
   * Krisp noise cancellation, applied to the published microphone track after
   * connect. Configurable off-room because the *choice* needs no track even
   * though previewing it does.
   */
  noiseFilterEnabled: boolean
  /** Camera background, applied to the published camera track after connect. */
  backgroundEffect: BackgroundEffect
}

const STORAGE_KEY = 'zentra-meet-user-choices'

export const defaultUserChoices: UserChoices = {
  username: '',
  videoEnabled: true,
  audioEnabled: true,
  noiseFilterEnabled: false,
  backgroundEffect: 'none',
}

export function loadUserChoices(): UserChoices {
  if (typeof window === 'undefined') return defaultUserChoices
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultUserChoices
    const stored = JSON.parse(raw) as Partial<UserChoices>
    const merged = { ...defaultUserChoices, ...stored }
    // A stored effect whose image was since removed would produce a processor
    // that silently does nothing, so an unrecognised value falls back rather
    // than being trusted.
    if (!isBackgroundEffect(merged.backgroundEffect)) {
      merged.backgroundEffect = defaultUserChoices.backgroundEffect
    }
    return merged
  } catch {
    return defaultUserChoices
  }
}

/**
 * Merges over what is stored rather than replacing it.
 *
 * PreJoin saves the five fields it owns and the settings dialog saves the two
 * it owns; a whole-object write from either would erase the other's. Merging is
 * the only version of this that cannot silently drop a preference.
 */
export function saveUserChoices(choices: Partial<UserChoices>) {
  try {
    const next = { ...loadUserChoices(), ...choices }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage may be unavailable (private browsing); choices just won't persist.
  }
}
