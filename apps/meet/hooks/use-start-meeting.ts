'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { encodePassphrase, generatePassphrase } from '@/lib/meet-utils'
import { storeCreatorToken } from '@/lib/creator-token'

/**
 * Creating an Instant Meeting and jumping into it.
 *
 * Extracted from HomeActions because the dashboard Shell's sidebar offers the
 * same action, and two copies of "store the Creator Token, then navigate" is
 * exactly the sort of duplication that loses a guest Organiser's authority
 * (ADR 0016) in one place and not the other.
 */
export function useStartMeeting() {
  const router = useRouter()
  const [starting, setStarting] = useState(false)

  const start = useCallback(
    async (options?: { e2ee?: boolean }) => {
      setStarting(true)
      try {
        const response = await fetch('/api/meetings', { method: 'POST' })
        if (!response.ok) {
          const body = await response.json().catch(() => null)
          throw new Error(body?.error ?? 'Could not start the meeting')
        }
        const { id, joinPath, creatorToken } = (await response.json()) as {
          id: string
          joinPath: string
          creatorToken?: string
        }
        // A guest Organiser's authority lives in this token (ADR 0016).
        if (creatorToken) storeCreatorToken(id, creatorToken)
        const hash = options?.e2ee
          ? `#${encodePassphrase(generatePassphrase())}`
          : ''
        router.push(`${joinPath}${hash}`)
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not start the meeting',
        )
      } finally {
        setStarting(false)
      }
    },
    [router],
  )

  return { start, starting }
}
