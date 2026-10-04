'use client'

import { CalendarClock, Video } from 'lucide-react'
import { buttonVariants } from '@zntr/ui/button'
import { cn } from '@zntr/utils'
import { CopyMeetingLink } from '@/components/dashboard/copy-meeting-link'
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
        <ul
          className="divide-y rounded-lg border bg-card dark:border-transparent"
          aria-busy="true"
        >
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
        <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border bg-card px-6 py-8 text-center dark:border-transparent">
          <CalendarClock className="mb-3 size-6 text-muted-foreground" />
          <p className="text-sm font-semibold">
            {failed ? 'Calendar unavailable' : 'No upcoming meetings'}
          </p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {failed
              ? 'Your calendar could not be reached just now.'
              : 'No meetings on your calendar yet. Add one from an event in Zentra Calendar.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card dark:border-transparent">
          {rows.map((item) => (
            <li
              key={`${item.meetingId}-${item.startDate}`}
              className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-muted/30"
            >
              <div
                className="hidden w-12 shrink-0 overflow-hidden rounded-md border text-center sm:block"
                aria-hidden="true"
              >
                <div className="bg-muted py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {new Intl.DateTimeFormat(undefined, {
                    month: 'short',
                  }).format(new Date(item.startDate))}
                </div>
                <div className="py-1.5 font-heading text-xl font-semibold tabular-nums">
                  {new Date(item.startDate).getDate()}
                </div>
              </div>
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate font-heading text-sm font-semibold sm:text-base">
                  {item.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {formatWhen(item.startDate, item.endDate)}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <CopyMeetingLink roomId={item.meetingId} />
                <JoinLink row={item} />
              </div>
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
      className={cn(buttonVariants(), 'h-11 px-4 text-xs sm:h-10', className)}
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
