'use client'

import { useEffect, useState } from 'react'

export interface UpcomingRow {
  meetingId: string
  eventId: string
  title: string
  /** ISO instant. Formatted in the visitor's own timezone at render time. */
  startDate: string
  endDate: string
}

export interface UpcomingState {
  /** null while loading. */
  rows: UpcomingRow[] | null
  failed: boolean
}

/**
 * Event Meetings on the user's calendar in the next 7 days.
 *
 * Fetched client-side for two reasons that predate this hook:
 *
 * 1. Times must be formatted in the VISITOR's timezone. In an async Server
 *    Component `Intl.DateTimeFormat(undefined, …)` resolves to the server's
 *    zone — UTC on Vercel — so users were shown a join time that was not
 *    theirs.
 * 2. The list comes from the calendar app's endpoint, which owns recurrence
 *    expansion. A Series' master row carries the anchor date, not an
 *    occurrence, so filtering on it here hid every recurring standup.
 *
 * A hook rather than component-local state because home surfaces the *next*
 * meeting and the Upcoming section lists all of them. Two components fetching
 * the same endpoint could disagree about what "next" is; one call in the shell
 * cannot.
 */
export function useUpcomingMeetings(calendarOrigin: string): UpcomingState {
  const [rows, setRows] = useState<UpcomingRow[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
        const response = await fetch(
          `${calendarOrigin}/api/meetings/upcoming?days=7&timezone=${encodeURIComponent(timezone)}`,
          // The session cookie is scoped to the shared parent domain, so it
          // must be sent on this cross-origin request explicitly.
          { credentials: 'include' },
        )
        if (!response.ok) throw new Error('failed')
        const body = (await response.json()) as { upcoming: UpcomingRow[] }
        if (!cancelled) setRows(body.upcoming)
      } catch {
        if (!cancelled) {
          setRows([])
          setFailed(true)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [calendarOrigin])

  return { rows, failed }
}
