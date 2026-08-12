import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIsMobile } from '@/hooks/useMobile'

describe('useMobile', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns false for desktop width', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('returns true for mobile width', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('cleans up event listener on unmount', () => {
    const removeEventListener = vi.fn()
    const matchMediaMock = vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      addEventListener: vi.fn(),
      removeEventListener,
      dispatchEvent: vi.fn(),
    }))

    Object.defineProperty(window, 'matchMedia', { value: matchMediaMock })
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })

    const { unmount } = renderHook(() => useIsMobile())
    unmount()

    expect(removeEventListener).toHaveBeenCalled()
  })
})
