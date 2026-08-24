'use client'

import { useEffect, useRef } from 'react'
import { checkPendingNotifications } from '@/lib/notifications'
import type { CalendarEvent } from '@/components/app/calendar'

const POLL_INTERVAL_MS = 60_000

export function useNotifications(events: CalendarEvent[]) {
  /**
   * The interval is created once and reads events through a ref. Closing over
   * `events` directly would either pin the poll to a stale array or force the
   * interval to be torn down and rebuilt on every revalidation.
   */
  const eventsRef = useRef(events)
  eventsRef.current = events

  useEffect(() => {
    void checkPendingNotifications(eventsRef.current)

    const interval = setInterval(() => {
      void checkPendingNotifications(eventsRef.current)
    }, POLL_INTERVAL_MS)

    return () => {
      clearInterval(interval)
    }
  }, [])
}
