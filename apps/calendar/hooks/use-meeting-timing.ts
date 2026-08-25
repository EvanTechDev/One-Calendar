'use client'

import { useEffect, useState } from 'react'
import { meetingTiming } from '@/lib/meeting-timing'
import type { MeetingTiming } from '@/lib/meeting-timing'
import type { CalendarEvent } from '@/components/app/calendar'

/** Coarse enough for a ten-minute threshold, cheap enough to leave running. */
const TICK_MS = 30_000

/**
 * Where an event sits relative to now, recomputed on a tick.
 *
 * A value computed once at mount goes stale in a tab left open — which is
 * exactly the tab someone has open when their meeting starts.
 */
export function useMeetingTiming(
  event: Pick<CalendarEvent, 'startDate' | 'endDate' | 'isAllDay'> | null,
): MeetingTiming {
  const [timing, setTiming] = useState<MeetingTiming>(() =>
    event ? meetingTiming(event) : 'upcoming',
  )

  useEffect(() => {
    if (!event) return
    const update = () => setTiming(meetingTiming(event))
    update()
    const interval = setInterval(update, TICK_MS)
    return () => clearInterval(interval)
    // Re-run when the event's own times change, not on every render of a new
    // object with the same values.
  }, [event?.startDate, event?.endDate, event?.isAllDay])

  return timing
}
