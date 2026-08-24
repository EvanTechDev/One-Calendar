export interface UserChoices {
  username: string
  videoEnabled: boolean
  audioEnabled: boolean
  videoDeviceId?: string
  audioDeviceId?: string
}

const STORAGE_KEY = 'zentra-meet-user-choices'

export const defaultUserChoices: UserChoices = {
  username: '',
  videoEnabled: true,
  audioEnabled: true,
}

export function loadUserChoices(): UserChoices {
  if (typeof window === 'undefined') return defaultUserChoices
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultUserChoices
    return { ...defaultUserChoices, ...JSON.parse(raw) }
  } catch {
    return defaultUserChoices
  }
}

export function saveUserChoices(choices: UserChoices) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(choices))
  } catch {
    // Storage may be unavailable (private browsing); choices just won't persist.
  }
}
