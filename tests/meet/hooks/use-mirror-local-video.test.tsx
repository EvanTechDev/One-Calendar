import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

/**
 * Mirroring was applied to any local camera, front or rear.
 *
 * It exists for the intuition of watching yourself — a front camera is the
 * closest thing to a mirror — but a rear camera points at the world, where a
 * flip only reverses it and any text in shot comes out backwards.
 *
 * A remote viewer is never mirrored either way: A's right hand appearing on the
 * left of B's screen is what two people face to face look like.
 */
const facing = { facingMode: 'user' as 'user' | 'environment' }

vi.mock('livekit-client', () => ({
  facingModeFromLocalTrack: () => ({
    facingMode: facing.facingMode,
    confidence: 'high',
  }),
  isLocalTrack: (track: unknown) => Boolean(track),
}))

const { useMirrorLocalVideo } = await import('@/hooks/use-mirror-local-video')

type Listener = () => void

function makeTrack() {
  const listeners = new Map<string, Set<Listener>>()
  return {
    on(event: string, listener: Listener) {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)!.add(listener)
      return this
    },
    off(event: string, listener: Listener) {
      listeners.get(event)?.delete(listener)
      return this
    },
    /** What switching between front and rear cameras fires. */
    restart() {
      listeners.get('restarted')?.forEach((listener) => listener())
    },
    listenerCount(event: string) {
      return listeners.get(event)?.size ?? 0
    },
  }
}

function trackRef(options: { isLocal: boolean; track?: unknown }) {
  return {
    participant: { isLocal: options.isLocal },
    publication: { track: options.track },
  } as never
}

beforeEach(() => {
  facing.facingMode = 'user'
})

describe('useMirrorLocalVideo', () => {
  it('mirrors your own front camera', () => {
    const { result } = renderHook(() =>
      useMirrorLocalVideo(
        trackRef({ isLocal: true, track: makeTrack() }),
        false,
      ),
    )
    expect(result.current).toBe(true)
  })

  it('does NOT mirror your own rear camera', () => {
    // The reported bug: a rear camera was flipped too, so the world came out
    // reversed.
    facing.facingMode = 'environment'
    const { result } = renderHook(() =>
      useMirrorLocalVideo(
        trackRef({ isLocal: true, track: makeTrack() }),
        false,
      ),
    )
    expect(result.current).toBe(false)
  })

  it('never mirrors a remote participant', () => {
    // Whatever their camera is doing, you see their true sensor orientation.
    const { result } = renderHook(() =>
      useMirrorLocalVideo(
        trackRef({ isLocal: false, track: makeTrack() }),
        false,
      ),
    )
    expect(result.current).toBe(false)
  })

  it('never mirrors a screen share, even your own', () => {
    // Flipping a shared screen would reverse every word on it.
    const { result } = renderHook(() =>
      useMirrorLocalVideo(
        trackRef({ isLocal: true, track: makeTrack() }),
        true,
      ),
    )
    expect(result.current).toBe(false)
  })

  it('follows a switch from front to rear without remounting', () => {
    const track = makeTrack()
    const { result } = renderHook(() =>
      useMirrorLocalVideo(trackRef({ isLocal: true, track }), false),
    )
    expect(result.current).toBe(true)

    // Switching cameras replaces the underlying MediaStreamTrack in place, so a
    // value read once at mount would keep mirroring the rear camera.
    facing.facingMode = 'environment'
    act(() => track.restart())
    expect(result.current).toBe(false)
  })

  it('follows a switch back to the front camera', () => {
    facing.facingMode = 'environment'
    const track = makeTrack()
    const { result } = renderHook(() =>
      useMirrorLocalVideo(trackRef({ isLocal: true, track }), false),
    )
    expect(result.current).toBe(false)

    facing.facingMode = 'user'
    act(() => track.restart())
    expect(result.current).toBe(true)
  })

  it('assumes a front camera before the track arrives', () => {
    // A laptop webcam is the common case, and `facingModeFromLocalTrack`
    // defaults to 'user' as well — so an un-mirrored first paint would flash.
    const { result } = renderHook(() =>
      useMirrorLocalVideo(trackRef({ isLocal: true, track: undefined }), false),
    )
    expect(result.current).toBe(true)
  })

  it('unsubscribes on unmount', () => {
    const track = makeTrack()
    const { unmount } = renderHook(() =>
      useMirrorLocalVideo(trackRef({ isLocal: true, track }), false),
    )
    expect(track.listenerCount('restarted')).toBe(1)
    unmount()
    expect(track.listenerCount('restarted')).toBe(0)
  })
})
