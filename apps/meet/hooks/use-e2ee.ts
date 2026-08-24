'use client'

import { useMemo } from 'react'
import { ExternalE2EEKeyProvider } from 'livekit-client'
import { decodePassphrase } from '@/lib/meet-utils'

export interface E2EESetup {
  enabled: boolean
  passphrase?: string
  worker?: Worker
  keyProvider?: ExternalE2EEKeyProvider
  /** Set when the hash exists but cannot be used — a damaged invite link. */
  error?: 'invalid-passphrase' | 'worker-unavailable'
}

/**
 * Reads the E2EE passphrase from the URL hash (never sent to the server)
 * and prepares the crypto worker + key provider when present.
 *
 * A truncated or rewritten invite link produces an invalid percent-escape,
 * which would throw during render, so decoding failures are reported as an
 * error state instead. The caller owns terminating the worker.
 */
export function useE2EE(): E2EESetup {
  return useMemo(() => {
    if (typeof window === 'undefined') return { enabled: false }
    const rawHash = window.location.hash.slice(1)
    if (!rawHash) return { enabled: false }

    let passphrase: string
    try {
      passphrase = decodePassphrase(rawHash)
    } catch {
      return { enabled: false, error: 'invalid-passphrase' }
    }
    if (!passphrase) return { enabled: false, error: 'invalid-passphrase' }

    try {
      const worker = new Worker(
        new URL('livekit-client/e2ee-worker', import.meta.url),
      )
      return {
        enabled: true,
        passphrase,
        worker,
        keyProvider: new ExternalE2EEKeyProvider(),
      }
    } catch {
      return { enabled: false, error: 'worker-unavailable' }
    }
  }, [])
}
