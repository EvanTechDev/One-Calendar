'use client'

import { SWRConfig } from 'swr'
import type { ReactNode } from 'react'

export function SwrProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        // Default retries on failure (3) amplify API load when the backend
        // is down — a single retry keeps resilience without the noise.
        errorRetryCount: 1,
      }}
    >
      {children}
    </SWRConfig>
  )
}
