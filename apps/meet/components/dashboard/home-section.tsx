'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, CalendarClock, Clock3, History, Plus } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { JoinMeetingForm } from '@/components/join-meeting-form'
import { CopyMeetingLink } from '@/components/dashboard/copy-meeting-link'
import { JoinLink, formatWhen } from '@/components/dashboard/upcoming-meetings'
import {
  firstName,
  greetingFor,
  meetingTiming,
  nextUpcoming,
} from '@/lib/home-summary'
import type { MeetSection } from '@/components/shell/meet-shell'
import type { UpcomingState } from '@/hooks/use-upcoming-meetings'

/** The meeting entry stays usable while the calendar and recent rooms load. */
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
    const refresh = () => {
      if (document.visibilityState !== 'hidden') setNow(new Date())
    }
    refresh()
    // A page left open should advance to the next scheduled meeting. Resume
    // immediately on tab return, even if background timers were throttled.
    const timer = setInterval(refresh, 30_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  const name = firstName(userName)
  const next = now ? nextUpcoming(upcoming.rows ?? [], now) : null

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
            {now ? greetingFor(now) : 'Welcome back'}
            {name ? `, ${name}` : ''}
          </h2>
          {now ? (
            <time
              dateTime={now.toISOString()}
              className="block text-xs text-muted-foreground"
            >
              {new Intl.DateTimeFormat(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              }).format(now)}
            </time>
          ) : null}
        </div>
        <Button className="h-11 px-4 sm:h-9" onClick={onNewMeeting}>
          <Plus className="size-4" />
          New meeting
        </Button>
      </div>

      <section
        className="grid items-center gap-4 rounded-lg border bg-card p-4 dark:border-transparent lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-8 lg:p-5"
        aria-labelledby="home-join-heading"
      >
        <div className="space-y-1">
          <h3 id="home-join-heading" className="text-sm font-semibold">
            Join a meeting
          </h3>
          <p className="text-xs text-muted-foreground">
            Go straight to your room with an invite.
          </p>
        </div>
        <JoinMeetingForm />
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section
          className="min-w-0 rounded-lg border bg-card dark:border-transparent"
          aria-labelledby="home-next-heading"
        >
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3 dark:border-border/50">
            <h3
              id="home-next-heading"
              className="flex items-center gap-2 text-sm font-semibold"
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
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
          <div className="p-4">
            {upcoming.rows === null ? (
              <div className="min-h-40 space-y-3 py-2" aria-busy="true">
                <div className="h-4 w-44 max-w-full animate-pulse rounded bg-muted motion-reduce:animate-none" />
                <div className="h-3 w-32 animate-pulse rounded bg-muted motion-reduce:animate-none" />
              </div>
            ) : next && now ? (
              <div className="flex min-h-40 flex-col">
                <p className="mb-3 flex items-center gap-1.5 text-xs font-medium tabular-nums">
                  <Clock3 className="size-3.5 text-muted-foreground" />
                  {meetingTiming(next, now)}
                </p>
                <div className="min-w-0 flex-1">
                  <p className="break-words font-heading text-lg font-semibold tracking-tight">
                    {next.title}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {formatWhen(next.startDate, next.endDate)}
                  </p>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                  <span className="select-all font-mono text-xs text-muted-foreground">
                    {next.meetingId}
                  </span>
                  <div className="flex items-center gap-1">
                    <CopyMeetingLink
                      key={next.meetingId}
                      roomId={next.meetingId}
                    />
                    <JoinLink row={next} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-40 flex-col items-center justify-center px-4 py-5 text-center">
                <CalendarClock className="mb-3 size-6 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {upcoming.failed
                    ? 'Calendar unavailable'
                    : 'No upcoming meetings'}
                </p>
                <p className="mt-1 max-w-64 text-xs leading-relaxed text-muted-foreground">
                  {upcoming.failed
                    ? 'Your calendar could not be reached just now.'
                    : 'Nothing on your calendar in the next 7 days.'}
                </p>
              </div>
            )}
          </div>
        </section>

        <section
          className="min-w-0 rounded-lg border bg-card dark:border-transparent"
          aria-labelledby="home-recent-heading"
        >
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3 dark:border-border/50">
            <h3
              id="home-recent-heading"
              className="flex items-center gap-2 text-sm font-semibold"
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
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
          <div className="p-4">{recentPreview}</div>
        </section>
      </div>
    </div>
  )
}
