import { Suspense } from 'react'
import { History } from 'lucide-react'
import {
  getEventTitlesForMeetings,
  getMeetingSummaries,
  listRecentMeetings,
} from '@zntr/meetings'
import { getDb } from '@/lib/drizzle'
import { readEventTitle } from '@/lib/event-title'
import { MeetingHistory } from '@/components/dashboard/meeting-history'
import { RecentRooms } from '@/components/dashboard/recent-rooms'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import type { MeetingRow } from '@/components/dashboard/meeting-history'

/** How many rooms home's rejoin list shows before deferring to Your meetings. */
const HOME_RECENT_LIMIT = 3

/**
 * The signed-in home, arranged as sections inside meet's Shell (see
 * components/shell/meet-shell.tsx) rather than one long centred column.
 *
 * Still an async Server Component doing the DB reads: the Shell is a client
 * component that takes these sections as children, so switching section is
 * client state while the data stays server-rendered.
 *
 * Every DB read sits inside its own Suspense boundary deliberately. Previously
 * a query blocked the whole page, so a slow (or failing) database took the
 * "start a meeting" path down with it — and that path needs no data at all. It
 * now lives in a dialog owned by the client shell, which renders regardless.
 */
export function Dashboard({
  calendarOrigin,
  userName,
  identity,
}: {
  calendarOrigin: string
  userName?: string
  identity?: React.ReactNode
}) {
  return (
    <DashboardShell
      calendarOrigin={calendarOrigin}
      userName={userName}
      identity={identity}
      recentPreview={
        <Suspense fallback={<RowsSkeleton rows={HOME_RECENT_LIMIT} />}>
          <RecentPreview />
        </Suspense>
      }
      history={
        <section className="space-y-4 p-4 sm:p-6">
          <h2 className="font-heading text-base font-semibold">
            Your meetings
          </h2>
          <Suspense fallback={<HistorySkeleton />}>
            <RecentMeetings />
          </Suspense>
        </section>
      }
    />
  )
}

async function RecentPreview() {
  return <RecentRooms rows={await recentRows(HOME_RECENT_LIMIT)} />
}

async function RecentMeetings() {
  return <MeetingHistory rows={await recentRows(20)} />
}

async function recentRows(limit: number): Promise<MeetingRow[]> {
  const db = getDb()
  const recent = await listRecentMeetings(db, await organiserId(), limit)

  const ids = recent.map((row) => row.id)
  const [titles, summaries] = await Promise.all([
    getEventTitlesForMeetings(db, ids),
    getMeetingSummaries(db, ids),
  ])

  // Event titles are encrypted at rest by the calendar app, so they are
  // decrypted with the owning event's id as the key material.
  return recent.map((row) => ({
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
}

/**
 * Read inside the suspended subtree so the session lookup does not block the
 * rest of the shell either.
 */
async function organiserId(): Promise<string> {
  const { getServerSession } = await import('@/lib/auth/server')
  const session = await getServerSession()
  // Dashboard only renders for a signed-in user; this is belt-and-braces.
  return session?.user.id ?? ''
}

function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <ul className="divide-y rounded-lg border" aria-busy="true">
      {Array.from({ length: rows }, (_, key) => (
        <li key={key} className="space-y-2 px-4 py-3">
          <div className="h-4 w-44 animate-pulse rounded bg-muted" />
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        </li>
      ))}
    </ul>
  )
}

function HistorySkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <History className="size-4 text-muted-foreground" />
        Recent
      </h3>
      <RowsSkeleton rows={3} />
    </div>
  )
}
