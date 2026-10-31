'use client'

import { Calendar, Repeat } from 'lucide-react'
import { cn } from '@zntr/utils'
import type { RoomEventContext } from '@/lib/event-context'

/**
 * What meeting this is — the event's title and time, falling back to the room
 * code. A room that shows only `ab3k-x9q2` gives no evidence a calendar exists,
 * which is the loudest way this integration used to feel unfinished.
 *
 * A client component on purpose: times must be formatted in the viewer's
 * timezone, and a server render would use the server's.
 */
export function MeetingIdentity({
  roomName,
  eventContext,
  className,
}: {
  roomName: string
  eventContext?: RoomEventContext
  className?: string
}) {
  if (!eventContext) {
    return (
      <span className={cn('truncate text-sm text-muted-foreground', className)}>
        {roomName}
      </span>
    )
  }

  const when = formatWhen(eventContext)

  return (
    <div className={cn('min-w-0', className)}>
      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
        {eventContext.recurring ? (
          <Repeat className="size-3 shrink-0 text-muted-foreground" />
        ) : (
          <Calendar className="size-3 shrink-0 text-muted-foreground" />
        )}
        {eventContext.title}
      </p>
      <p className="truncate text-xs text-muted-foreground">
        {when ? `${when} · ` : ''}
        {roomName}
      </p>
    </div>
  )
}

/**
 * The event's time on its own, for surfaces that already show the title
 * (the pre-join screen puts it in the heading).
 */
export function MeetingWhen({
  eventContext,
}: {
  eventContext: RoomEventContext
}) {
  const when = formatWhen(eventContext)
  if (!when) {
    return eventContext.recurring ? (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Repeat className="size-3.5" />
        Recurring meeting
      </p>
    ) : null
  }
  return (
    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Calendar className="size-3.5" />
      {when}
    </p>
  )
}

function formatWhen(context: RoomEventContext): string | null {
  // A recurring event's master row carries the recurrence anchor, not this
  // sitting's time, so there is nothing honest to show.
  if (!context.startsAt || !context.endsAt) return null

  const start = new Date(context.startsAt)
  const end = new Date(context.endsAt)
  const day = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(start)
  const time = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${day}, ${time.format(start)} – ${time.format(end)}`
}
