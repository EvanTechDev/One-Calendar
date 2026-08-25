import { Suspense } from 'react'
import { History } from 'lucide-react'
import {
  getEventTitlesForMeetings,
  getMeetingSummaries,
  listRecentMeetings,
} from '@zntr/meetings'
import { getDb } from '@/lib/drizzle'
import { readEventTitle } from '@/lib/event-title'
import { HomeActions } from '@/components/home-actions'
import { MeetingHistory } from '@/components/dashboard/meeting-history'
import { UpcomingMeetings } from '@/components/dashboard/upcoming-meetings'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import type { MeetingRow } from '@/components/dashboard/meeting-history'

/**
 * The signed-in home, arranged as sections inside meet's Shell (see
 * components/shell/meet-shell.tsx) rather than one long centred column.
 *
 * Still an async Server Component doing the DB reads: the Shell is a client
 * component that takes these sections as children, so switching section is
 * client state while the data stays server-rendered.
 *
 * Quick actions render OUTSIDE the data-dependent sections deliberately.
 * Previously every query blocked the whole page, so a slow (or failing)
 * database took "start a meeting" down with it — the one action on this page
 * that needs no data at all.
 */
export function Dashboard({
  calendarOrigin,
  identity,
}: {
  calendarOrigin: string
  identity?: React.ReactNode
}) {
  return (
    <DashboardShell
      identity={identity}
      home={
        <Section
          title="Start or join"
          description="Open a meeting now, or enter a code you were given."
        >
          <div className="max-w-md">
            <HomeActions />
          </div>
        </Section>
      }
      upcoming={
        /* Fetched client-side from the calendar app, which owns recurrence
           expansion and formats in the visitor's timezone. */
        <Section title="Next 7 days">
          <UpcomingMeetings calendarOrigin={calendarOrigin} />
        </Section>
      }
      history={
        <Section title="Your meetings">
          <Suspense fallback={<HistorySkeleton />}>
            <RecentMeetings />
          </Suspense>
        </Section>
      }
    />
  )
}

/**
 * One section of the Shell's main column. The `h-16` header already names the
 * active section, so this heading is the section's own sub-structure.
 */
function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4 border-b p-4 last:border-b-0 sm:p-6">
      <div className="space-y-1">
        <h2 className="font-heading text-base font-semibold">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

async function RecentMeetings() {
  const db = getDb()
  const recent = await listRecentMeetings(db, await organiserId(), 20)

  const ids = recent.map((row) => row.id)
  const [titles, summaries] = await Promise.all([
    getEventTitlesForMeetings(db, ids),
    getMeetingSummaries(db, ids),
  ])

  // Event titles are encrypted at rest by the calendar app, so they are
  // decrypted with the owning event's id as the key material.
  const rows: MeetingRow[] = recent.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    eventTitle:
      row.eventId && titles[row.id]
        ? readEventTitle(row.eventId, titles[row.id]!)
        : null,
    totalMinutes: summaries[row.id]?.totalMinutes ?? 0,
    attendees: summaries[row.id]?.attendees ?? 0,
  }))

  return <MeetingHistory rows={rows} />
}

/**
 * Read inside the suspended subtree so the session lookup does not block the
 * quick actions either.
 */
async function organiserId(): Promise<string> {
  const { getServerSession } = await import('@/lib/auth/server')
  const session = await getServerSession()
  // Dashboard only renders for a signed-in user; this is belt-and-braces.
  return session?.user.id ?? ''
}

function HistorySkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <History className="size-4 text-muted-foreground" />
        Recent
      </h3>
      <ul className="divide-y rounded-lg border">
        {[0, 1, 2].map((key) => (
          <li key={key} className="space-y-2 px-4 py-3">
            <div className="h-4 w-44 animate-pulse rounded bg-muted" />
            <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          </li>
        ))}
      </ul>
    </div>
  )
}
