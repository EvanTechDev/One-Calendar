'use client'

import { Video } from 'lucide-react'
import type { UpcomingRow, UpcomingState } from '@/hooks/use-upcoming-meetings'

export type { UpcomingRow } from '@/hooks/use-upcoming-meetings'

/**
 * The Upcoming section's list. Presentational: the fetch moved into
 * `useUpcomingMeetings`, called once by the shell, so home's "next meeting"
 * card and this list can never disagree about what is next.
 */
export function UpcomingMeetings({ rows, failed }: UpcomingState) {
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
              <JoinLink row={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function JoinLink({
  row,
  className,
}: {
  row: UpcomingRow
  className?: string
}) {
  return (
    <a
      href={`/${row.meetingId}`}
      className={
        className ??
        'inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'
      }
    >
      <Video className="size-3.5" />
      Join
    </a>
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
