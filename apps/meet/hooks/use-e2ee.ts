'use client'

import { useMemo } from 'react'
import { ExternalE2EEKeyProvider } from 'livekit-client'
import { decodePassphrase } from '@/lib/meet-utils'

export interface E2EESetup {
  enabled: boolean
  passphrase?: string
  worker?: Worker
  keyProvider?: ExternalE2EEKeyProvider
}

/**
 * Reads the E2EE passphrase from the URL hash (never sent to the server)
 * and prepares the crypto worker + key provider when present.
 */
export function useE2EE(): E2EESetup {
  return useMemo(() => {
    if (typeof window === 'undefined') return { enabled: false }
    const rawHash = window.location.hash.slice(1)
    if (!rawHash) return { enabled: false }
    const passphrase = decodePassphrase(rawHash)
    const worker = new Worker(
      new URL('livekit-client/e2ee-worker', import.meta.url),
    )
    return {
      enabled: true,
      passphrase,
      worker,
      keyProvider: new ExternalE2EEKeyProvider(),
    }
  }, [])
}
