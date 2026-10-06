'use client'

import { useEffect, useRef } from 'react'
import { checkPendingNotifications } from '#calendar/lib/notifications'
import type { CalendarEvent } from '#calendar/components/app/calendar'
import { useCalendarHost } from '@zntr/utils/calendar-host'

const POLL_INTERVAL_MS = 60_000

export function useNotifications(events: CalendarEvent[]) {
  const { platform } = useCalendarHost()
  /**
   * The interval is created once and reads events through a ref. Closing over
   * `events` directly would either pin the poll to a stale array or force the
   * interval to be torn down and rebuilt on every revalidation.
   */
  const eventsRef = useRef(events)
  eventsRef.current = events

  useEffect(() => {
    if (platform === 'desktop') return
    void checkPendingNotifications(eventsRef.current)

    const interval = setInterval(() => {
      void checkPendingNotifications(eventsRef.current)
    }, POLL_INTERVAL_MS)

    return () => {
      clearInterval(interval)
    }
  }, [platform])
}
