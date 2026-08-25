'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

/**
 * "Add Zentra Meet" pressed on a draft event.
 *
 * A draft has no row yet, so the Meeting cannot be created until the event
 * exists (ADR-0019 — the attachment lives on `meeting.eventId` and nowhere
 * else). This hook owns the whole lifecycle of that deferred intent, because
 * splitting it across the editor and its field is what produced two bugs:
 *
 * - The intent was never cleared, so arming it on an abandoned draft attached
 *   a meeting to the next, unrelated event created.
 * - The POST fired alongside the event insert rather than after it, so the API
 *   answered 404 for a row that did not exist yet — and the fire-and-forget
 *   never checked the response, so the organiser was told nothing at all.
 */
export interface PendingMeeting {
  /** True while the intent is armed. */
  pending: boolean
  setPending: (next: boolean) => void
  /**
   * Creates the Meeting for a just-saved event, after `eventWrite` settles.
   * A no-op when nothing is armed. Never throws: the event itself saved, so
   * this reports through a toast rather than failing the save.
   */
  attach: (
    eventId: string,
    eventWrite?: void | Promise<unknown>,
  ) => Promise<void>
}

export function usePendingMeeting(open: boolean): PendingMeeting {
  const [pending, setPending] = useState(false)

  // Closing the editor ends the draft that armed the intent. Its own effect so
  // nothing else re-rendering while the editor is open can disarm it.
  useEffect(() => {
    if (!open) setPending(false)
  }, [open])

  const attach = useCallback(
    async (eventId: string, eventWrite?: void | Promise<unknown>) => {
      if (!pending) return
      setPending(false)
      try {
        // The row must exist before the meeting can point at it.
        await eventWrite
        const response = await fetch('/api/meetings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId }),
        })
        if (!response.ok) throw new Error('attach failed')
      } catch {
        toast.error('The event saved, but the meeting could not be added')
      }
    },
    [pending],
  )

  return { pending, setPending, attach }
}
