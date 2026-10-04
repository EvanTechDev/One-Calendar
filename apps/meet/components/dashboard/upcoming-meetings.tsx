'use client'

import { CalendarClock, Video } from 'lucide-react'
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
        <ul className="divide-y rounded-2xl border bg-card" aria-busy="true">
          {[0, 1].map((key) => (
            <li key={key} className="flex items-center gap-3 p-5">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-40 max-w-full animate-pulse rounded bg-muted motion-reduce:animate-none" />
                <div className="h-3 w-28 animate-pulse rounded bg-muted motion-reduce:animate-none" />
              </div>
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border bg-card px-6 py-10 text-center">
          <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-meet-tint text-meet-accent">
            <CalendarClock className="size-6" />
          </span>
          <p className="font-heading text-lg font-semibold">
            {failed
              ? 'Calendar unavailable'
              : 'Your next conversation starts here'}
          </p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {failed
              ? 'Your calendar could not be reached just now.'
              : 'No meetings on your calendar yet. Add one from an event in Zentra Calendar.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {rows.map((item) => (
            <li
              key={`${item.meetingId}-${item.startDate}`}
              className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/30 sm:p-5"
            >
              <div
                className="hidden w-14 shrink-0 overflow-hidden rounded-xl border text-center sm:block"
                aria-hidden="true"
              >
                <div className="bg-meet-tint py-1 text-[10px] font-semibold uppercase tracking-wide text-meet-accent">
                  {new Intl.DateTimeFormat(undefined, {
                    month: 'short',
                  }).format(new Date(item.startDate))}
                </div>
                <div className="py-1.5 font-heading text-xl font-semibold tabular-nums">
                  {new Date(item.startDate).getDate()}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-sm font-semibold sm:text-base">
                  {item.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
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
        'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-meet-accent px-4 text-xs font-medium text-white transition-colors hover:bg-meet-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:text-background'
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
