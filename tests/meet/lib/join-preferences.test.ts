import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The end of the round-trip: a preference written by the settings dialog is
 * read at join time and actually attached to a track.
 *
 * A setting that saves and does nothing is worse than an absent one, and the
 * dashboard has no room to prove it against — so the two processor libraries
 * are faked and the assertion is that `setProcessor` was called with the right
 * thing. Both are dynamically imported inside applyJoinPreferences, so the
 * mocks must be declared before the module under test is loaded.
 */

const krisp = {
  KrispNoiseFilter: vi.fn((options?: unknown) => ({
    name: 'livekit-noise-filter',
    options,
  })),
  isKrispNoiseFilterSupported: vi.fn(() => true),
}

const processors = {
  BackgroundBlur: vi.fn((radius: number) => ({
    name: 'background-blur',
    radius,
  })),
  VirtualBackground: vi.fn((url: string) => ({
    name: 'virtual-background',
    url,
  })),
}

vi.mock('@livekit/krisp-noise-filter', () => krisp)
vi.mock('@livekit/track-processors', () => processors)

const { applyJoinPreferences } = await import('@/lib/join-preferences')
const { loadUserChoices, saveUserChoices } = await import('@/lib/user-choices')

function fakeTrack() {
  return {
    setProcessor: vi.fn(async () => {}),
    getProcessor: vi.fn(() => undefined),
  }
}

/** jsdom's Image never fires load, so the decode check needs a real answer. */
function stubImageLoads(ok: boolean) {
  class StubImage {
    crossOrigin = ''
    naturalWidth = ok ? 640 : 0
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(_value: string) {
      queueMicrotask(() => (ok ? this.onload?.() : this.onerror?.()))
    }
  }
  vi.stubGlobal('Image', StubImage)
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  krisp.isKrispNoiseFilterSupported.mockReturnValue(true)
  stubImageLoads(true)
})

describe('applyJoinPreferences', () => {
  it('attaches the Krisp filter when the stored preference is on', async () => {
    // Written exactly as the settings dialog writes it.
    saveUserChoices({ noiseFilterEnabled: true })
    const audioTrack = fakeTrack()

    // Read exactly as the join path reads it.
    const stored = loadUserChoices()
    await applyJoinPreferences(
      { audioTrack },
      {
        noiseFilterEnabled: stored.noiseFilterEnabled,
        backgroundEffect: stored.backgroundEffect,
      },
    )

    expect(audioTrack.setProcessor).toHaveBeenCalledOnce()
    expect(audioTrack.setProcessor.mock.calls[0]![0]).toMatchObject({
      name: 'livekit-noise-filter',
    })
  })

  it('leaves the microphone alone when the preference is off', async () => {
    const audioTrack = fakeTrack()
    const stored = loadUserChoices()
    await applyJoinPreferences(
      { audioTrack },
      {
        noiseFilterEnabled: stored.noiseFilterEnabled,
        backgroundEffect: stored.backgroundEffect,
      },
    )
    expect(audioTrack.setProcessor).not.toHaveBeenCalled()
  })

  it('does not attach Krisp on a browser that cannot run it', async () => {
    krisp.isKrispNoiseFilterSupported.mockReturnValue(false)
    const audioTrack = fakeTrack()
    await applyJoinPreferences(
      { audioTrack },
      { noiseFilterEnabled: true, backgroundEffect: 'none' },
    )
    expect(audioTrack.setProcessor).not.toHaveBeenCalled()
  })

  it('does not re-attach a filter the track already carries', async () => {
    const audioTrack = fakeTrack()
    audioTrack.getProcessor = vi.fn(() => ({ name: 'livekit-noise-filter' }))
    await applyJoinPreferences(
      { audioTrack },
      { noiseFilterEnabled: true, backgroundEffect: 'none' },
    )
    expect(audioTrack.setProcessor).not.toHaveBeenCalled()
  })

  it('applies a stored blur to the camera track', async () => {
    saveUserChoices({ backgroundEffect: 'blur' })
    const videoTrack = fakeTrack()
    const stored = loadUserChoices()
    await applyJoinPreferences(
      { videoTrack },
      {
        noiseFilterEnabled: stored.noiseFilterEnabled,
        backgroundEffect: stored.backgroundEffect,
      },
    )
    expect(processors.BackgroundBlur).toHaveBeenCalledWith(10)
    expect(videoTrack.setProcessor).toHaveBeenCalledOnce()
  })

  it('applies a stored image background from the shared path table', async () => {
    saveUserChoices({ backgroundEffect: 'office' })
    const videoTrack = fakeTrack()
    const stored = loadUserChoices()
    await applyJoinPreferences(
      { videoTrack },
      {
        noiseFilterEnabled: stored.noiseFilterEnabled,
        backgroundEffect: stored.backgroundEffect,
      },
    )
    expect(processors.VirtualBackground).toHaveBeenCalledWith(
      '/backgrounds/office.jpg',
    )
  })

  // The git-lfs-stub failure: a processor built from an undecodable image
  // resolves happily and shows nothing.
  it('refuses to build a processor from an image that does not decode', async () => {
    stubImageLoads(false)
    const videoTrack = fakeTrack()
    await applyJoinPreferences(
      { videoTrack },
      { noiseFilterEnabled: false, backgroundEffect: 'mountains' },
    )
    expect(processors.VirtualBackground).not.toHaveBeenCalled()
    expect(videoTrack.setProcessor).not.toHaveBeenCalled()
  })

  it('is a no-op when the user joined muted and camera-off', async () => {
    // No track exists to process; this must not throw.
    await expect(
      applyJoinPreferences(
        {},
        { noiseFilterEnabled: true, backgroundEffect: 'blur' },
      ),
    ).resolves.toBeUndefined()
  })

  it('does not let a failing background cost the noise filter', async () => {
    const audioTrack = fakeTrack()
    const videoTrack = fakeTrack()
    videoTrack.setProcessor = vi.fn(async () => {
      throw new Error('unsupported on this device')
    })
    await applyJoinPreferences(
      { audioTrack, videoTrack },
      { noiseFilterEnabled: true, backgroundEffect: 'blur' },
    )
    expect(audioTrack.setProcessor).toHaveBeenCalledOnce()
  })
})
