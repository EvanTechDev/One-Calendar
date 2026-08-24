import { describe, it, expect, beforeEach } from 'vitest'
import {
  defaultUserChoices,
  loadUserChoices,
  saveUserChoices,
} from '@/lib/user-choices'

const STORAGE_KEY = 'zentra-meet-user-choices'

describe('user choices persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('falls back to defaults when nothing is stored', () => {
    expect(loadUserChoices()).toEqual(defaultUserChoices)
  })

  it('round-trips a full set of choices', () => {
    const choices = {
      username: 'Ada',
      videoEnabled: false,
      audioEnabled: true,
      videoDeviceId: 'cam-1',
      audioDeviceId: 'mic-1',
    }
    saveUserChoices(choices)
    expect(loadUserChoices()).toEqual(choices)
  })

  it('merges partial stored values over the defaults', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ username: 'Grace' }))
    const loaded = loadUserChoices()
    expect(loaded.username).toBe('Grace')
    expect(loaded.videoEnabled).toBe(defaultUserChoices.videoEnabled)
    expect(loaded.audioEnabled).toBe(defaultUserChoices.audioEnabled)
  })

  it('returns defaults when the stored value is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(loadUserChoices()).toEqual(defaultUserChoices)
  })
})
