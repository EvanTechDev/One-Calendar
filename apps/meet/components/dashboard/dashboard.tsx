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
import type { MeetingRow } from '@/components/dashboard/meeting-history'

/**
 * The signed-in home: quick actions on top, then the two lists that make the
 * calendar integration visible — meetings attached to upcoming events, and the
 * user's own meeting history with duration and attendance.
 *
 * Quick actions render OUTSIDE the data-dependent sections deliberately.
 * Previously every query blocked the whole page, so a slow (or failing)
 * database took "start a meeting" down with it — the one action on this page
 * that needs no data at all.
 */
export function Dashboard({ calendarOrigin }: { calendarOrigin: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 px-6 py-10">
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Meet</h1>
        <HomeActions />
      </section>

      {/* Fetched client-side from the calendar app, which owns recurrence
          expansion and formats in the visitor's timezone. */}
      <UpcomingMeetings calendarOrigin={calendarOrigin} />

      <Suspense fallback={<HistorySkeleton />}>
        <RecentMeetings />
      </Suspense>
    </div>
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
    <section className="space-y-3" aria-busy="true">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <History className="size-4 text-muted-foreground" />
        Recent
      </h2>
      <ul className="divide-y rounded-lg border">
        {[0, 1, 2].map((key) => (
          <li key={key} className="space-y-2 px-4 py-3">
            <div className="h-4 w-44 animate-pulse rounded bg-muted" />
            <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          </li>
        ))}
      </ul>
    </section>
  )
}
