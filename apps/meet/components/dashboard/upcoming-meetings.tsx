'use client'

import { useEffect, useState } from 'react'
import { Video } from 'lucide-react'

export interface UpcomingRow {
  meetingId: string
  eventId: string
  title: string
  /** ISO instant. Formatted here, in the visitor's own timezone. */
  startDate: string
  endDate: string
}

/**
 * Event Meetings on the user's calendar in the next 7 days.
 *
 * A client component for two reasons:
 *
 * 1. Times must be formatted in the VISITOR's timezone. Rendered in an async
 *    Server Component, `Intl.DateTimeFormat(undefined, …)` resolves to the
 *    server's zone — UTC on Vercel — so users were shown a join time that was
 *    not theirs, and would join at the wrong moment.
 * 2. The list comes from the calendar app's endpoint, which expands recurring
 *    series properly. A Series' master row carries the anchor date, not an
 *    occurrence, so filtering on it hid every recurring standup.
 */
export function UpcomingMeetings({
  calendarOrigin,
}: {
  calendarOrigin: string
}) {
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

  return (
    // The Shell's section header already names this, so the list carries no
    // heading of its own.
    <div className="space-y-3">
      {rows === null ? (
        <ul className="divide-y rounded-lg border" aria-busy="true">
          {[0, 1].map((key) => (
            <li key={key} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                <div className="h-3 w-28 animate-pulse rounded bg-muted" />
              </div>
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {failed
            ? 'Your calendar could not be reached just now.'
            : 'No meetings on your calendar yet. Add one from an event in Zentra Calendar.'}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((item) => (
            <li
              key={`${item.meetingId}-${item.startDate}`}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatWhen(item.startDate, item.endDate)}
                </p>
              </div>
              <a
                href={`/${item.meetingId}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
              >
                <Video className="size-3.5" />
                Join
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Formatted with the browser's own locale and timezone. */
export function formatWhen(startIso: string, endIso: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const date = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(start)
  const time = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${date} · ${time.format(start)} – ${time.format(end)}`
}
