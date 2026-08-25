'use client'

import { useEffect, useState } from 'react'
import { CalendarClock, History, Plus } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { JoinLink, formatWhen } from '@/components/dashboard/upcoming-meetings'
import { firstName, greetingFor, nextUpcoming } from '@/lib/home-summary'
import type { MeetSection } from '@/components/shell/meet-shell'
import type { UpcomingState } from '@/hooks/use-upcoming-meetings'

/**
 * Home, after start/join moved into the New meeting dialog.
 *
 * What is left is orientation, not action storage. Three questions a user
 * arriving here actually has, in the order they have them:
 *
 * 1. "Am I late?" — the single next meeting, inline, with its Join button. Not
 *    the whole list: Upcoming is a section of its own, and a list here would be
 *    the same content twice.
 * 2. "Where was that room?" — the three most recent meetings, since rejoining
 *    a room you were just in is the second most common thing after starting
 *    one. The full, searchable set stays in Your meetings.
 * 3. "How do I start one?" — one unmissable button onto the dialog, repeated
 *    from the sidebar because a sidebar action is invisible on mobile, where
 *    the rail collapses into a Sheet.
 *
 * Greeting first because it is the cheapest way to make an otherwise
 * data-dependent page render something true immediately — the DB may be slow
 * or down, and home should not be blank when it is.
 */
export function HomeSection({
  userName,
  upcoming,
  recentPreview,
  onNewMeeting,
  onSectionChange,
}: {
  userName?: string
  upcoming: UpcomingState
  /** Server-rendered compact recent list, suspended by the caller. */
  recentPreview: React.ReactNode
  onNewMeeting: () => void
  onSectionChange: (section: MeetSection) => void
}) {
  // Resolved after mount: rendering a local-time greeting on the server would
  // resolve to the server's clock (UTC on Vercel) and then flip on hydration.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
  }, [])

  const name = firstName(userName)
  const next = now ? nextUpcoming(upcoming.rows ?? [], now) : null

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="space-y-1">
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          {now ? greetingFor(now) : 'Welcome back'}
          {name ? `, ${name}` : ''}
        </h2>
        <p className="text-sm text-muted-foreground">
          Start a meeting, or pick up where you left off.
        </p>
      </div>

      <Button className="w-full sm:w-auto" size="lg" onClick={onNewMeeting}>
        <Plus className="size-4" />
        New meeting
      </Button>

      <section className="space-y-3" aria-labelledby="home-next-heading">
        <div className="flex items-center justify-between gap-3">
          <h3
            id="home-next-heading"
            className="flex items-center gap-2 text-sm font-medium"
          >
            <CalendarClock className="size-4 text-muted-foreground" />
            Next meeting
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSectionChange('upcoming')}
          >
            See all
          </Button>
        </div>
        {upcoming.rows === null ? (
          <div
            className="space-y-2 rounded-lg border px-4 py-3"
            aria-busy="true"
          >
            <div className="h-4 w-44 animate-pulse rounded bg-muted" />
            <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          </div>
        ) : next ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{next.title}</p>
              <p className="text-xs text-muted-foreground">
                {formatWhen(next.startDate, next.endDate)}
              </p>
            </div>
            <JoinLink row={next} />
          </div>
        ) : (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            {upcoming.failed
              ? 'Your calendar could not be reached just now.'
              : 'Nothing on your calendar in the next 7 days.'}
          </p>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="home-recent-heading">
        <div className="flex items-center justify-between gap-3">
          <h3
            id="home-recent-heading"
            className="flex items-center gap-2 text-sm font-medium"
          >
            <History className="size-4 text-muted-foreground" />
            Recent rooms
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSectionChange('history')}
          >
            See all
          </Button>
        </div>
        {recentPreview}
      </section>
    </div>
  )
}
