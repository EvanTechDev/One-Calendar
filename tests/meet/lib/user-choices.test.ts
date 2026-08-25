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
      noiseFilterEnabled: true,
      backgroundEffect: 'blur' as const,
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
    expect(loaded.noiseFilterEnabled).toBe(
      defaultUserChoices.noiseFilterEnabled,
    )
    expect(loaded.backgroundEffect).toBe(defaultUserChoices.backgroundEffect)
  })

  it('returns defaults when the stored value is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(loadUserChoices()).toEqual(defaultUserChoices)
  })

  // The whole point of one store: the settings dialog and the PreJoin screen
  // each write only the fields they own, and a replacing write from either
  // would silently erase the other's.
  it('merges a partial write over what is already stored', () => {
    saveUserChoices({ username: 'Ada', audioEnabled: false })
    saveUserChoices({ noiseFilterEnabled: true })
    const loaded = loadUserChoices()
    expect(loaded.username).toBe('Ada')
    expect(loaded.audioEnabled).toBe(false)
    expect(loaded.noiseFilterEnabled).toBe(true)
  })

  it('does not lose the join-state fields when PreJoin saves its own', () => {
    saveUserChoices({ noiseFilterEnabled: true, backgroundEffect: 'office' })
    saveUserChoices({
      username: 'Grace',
      videoEnabled: false,
      audioEnabled: true,
      videoDeviceId: 'cam-2',
      audioDeviceId: 'mic-2',
    })
    const loaded = loadUserChoices()
    expect(loaded.noiseFilterEnabled).toBe(true)
    expect(loaded.backgroundEffect).toBe('office')
  })

  // A stored effect whose image was since removed would produce a processor
  // that silently does nothing — the exact failure mode of the git-lfs stubs.
  it('rejects an unrecognised background effect', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ backgroundEffect: 'lagoon' }),
    )
    expect(loadUserChoices().backgroundEffect).toBe('none')
  })
})
