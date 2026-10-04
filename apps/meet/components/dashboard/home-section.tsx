'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, CalendarClock, Clock3, History, Video } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { MeetingIllustration } from '@/components/dashboard/meeting-illustration'
import { JoinLink, formatWhen } from '@/components/dashboard/upcoming-meetings'
import { firstName, greetingFor, nextUpcoming } from '@/lib/home-summary'
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
    setNow(new Date())
  }, [])

  const name = firstName(userName)
  const next = now ? nextUpcoming(upcoming.rows ?? [], now) : null

  return (
    <div className="mx-auto max-w-7xl space-y-7 p-4 sm:p-6 lg:space-y-9 lg:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h2 className="font-heading text-2xl font-semibold tracking-tight lg:text-3xl">
            {now ? greetingFor(now) : 'Welcome back'}
            {name ? `, ${name}` : ''}
          </h2>
          <p className="text-sm text-muted-foreground">
            A fresh conversation, or a familiar room.
          </p>
        </div>
        {now ? (
          <time
            dateTime={now.toISOString()}
            className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm"
          >
            <CalendarClock className="size-4" />
            {new Intl.DateTimeFormat(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            }).format(now)}
          </time>
        ) : null}
      </div>

      <section
        className="meet-launch relative isolate grid overflow-hidden rounded-3xl border border-meet-accent/10 lg:grid-cols-[1.1fr_1fr]"
        aria-labelledby="home-start-heading"
      >
        <div className="relative z-10 p-6 sm:p-8 lg:py-10 lg:pl-10">
          <span className="mb-5 inline-flex items-center gap-2 text-xs font-medium text-meet-accent">
            <Video className="size-4" />
            Your space to connect
          </span>
          <h3
            id="home-start-heading"
            className="max-w-md font-heading text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl"
          >
            Good conversations
            <br />
            start here.
          </h3>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Open a room, share the link, and bring everyone together.
          </p>
          <Button
            className="mt-7 h-11 gap-2 rounded-xl bg-meet-accent px-5 text-white hover:bg-meet-accent/90 dark:text-background"
            size="lg"
            onClick={onNewMeeting}
          >
            <Video className="size-4" />
            New meeting
            <ArrowRight className="ml-2 size-4" />
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Start a room or join with a code or link.
          </p>
        </div>
        <MeetingIllustration />
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section
          className="min-w-0 rounded-2xl border bg-card"
          aria-labelledby="home-next-heading"
        >
          <div className="flex items-center justify-between gap-3 px-5 pt-5">
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
          <div className="p-5">
            {upcoming.rows === null ? (
              <div
                className="min-h-44 space-y-3 rounded-xl bg-muted/50 p-5"
                aria-busy="true"
              >
                <div className="h-4 w-44 max-w-full animate-pulse rounded bg-muted motion-reduce:animate-none" />
                <div className="h-3 w-32 animate-pulse rounded bg-muted motion-reduce:animate-none" />
              </div>
            ) : next ? (
              <div className="relative min-h-44 overflow-hidden rounded-xl bg-meet-tint p-5 before:absolute before:inset-y-5 before:left-0 before:w-1 before:rounded-r-full before:bg-meet-accent">
                <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-meet-accent">
                  <Clock3 className="size-3.5" />
                  Next on your calendar
                </p>
                <div className="min-w-0">
                  <p className="break-words font-heading text-lg font-semibold tracking-tight">
                    {next.title}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {formatWhen(next.startDate, next.endDate)}
                  </p>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <span className="font-mono text-xs text-muted-foreground">
                    {next.meetingId}
                  </span>
                  <JoinLink row={next} />
                </div>
              </div>
            ) : (
              <div className="flex min-h-44 flex-col items-center justify-center rounded-xl bg-muted/40 px-5 py-6 text-center">
                <span className="mb-3 flex size-11 items-center justify-center rounded-2xl border bg-background text-meet-accent">
                  <CalendarClock className="size-5" />
                </span>
                <p className="text-sm font-medium">
                  {upcoming.failed
                    ? 'Calendar unavailable'
                    : 'A little breathing room'}
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
          className="min-w-0 rounded-2xl border bg-card"
          aria-labelledby="home-recent-heading"
        >
          <div className="flex items-center justify-between gap-3 px-5 pt-5">
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
          <div className="p-5">{recentPreview}</div>
        </section>
      </div>
    </div>
  )
}
