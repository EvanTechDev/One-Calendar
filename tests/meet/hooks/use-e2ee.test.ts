import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useE2EE } from '@/hooks/use-e2ee'

// jsdom has no Worker; the hook only needs construction to succeed.
class WorkerStub {
  terminate() {}
}

function setHash(hash: string) {
  window.location.hash = hash
}

describe('useE2EE', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', WorkerStub)
    setHash('')
  })

  it('stays disabled without a hash', () => {
    const { result } = renderHook(() => useE2EE())
    expect(result.current.enabled).toBe(false)
    expect(result.current.error).toBeUndefined()
  })

  it('enables encryption for a well-formed passphrase', () => {
    setHash('#abc123')
    const { result } = renderHook(() => useE2EE())
    expect(result.current.enabled).toBe(true)
    expect(result.current.passphrase).toBe('abc123')
    expect(result.current.worker).toBeDefined()
    expect(result.current.keyProvider).toBeDefined()
  })

  it('decodes a percent-encoded passphrase', () => {
    setHash(`#${encodeURIComponent('a b/c')}`)
    const { result } = renderHook(() => useE2EE())
    expect(result.current.passphrase).toBe('a b/c')
  })

  it('reports a damaged link instead of throwing during render', () => {
    // Regression: a truncated invite link used to throw URIError out of
    // render, white-screening the room with no error boundary.
    setHash('#%zz')
    const { result } = renderHook(() => useE2EE())
    expect(result.current.enabled).toBe(false)
    expect(result.current.error).toBe('invalid-passphrase')
  })

  it('reports when the crypto worker cannot be created', () => {
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          throw new Error('workers unavailable')
        }
      },
    )
    setHash('#abc123')
    const { result } = renderHook(() => useE2EE())
    expect(result.current.enabled).toBe(false)
    expect(result.current.error).toBe('worker-unavailable')
  })
})
