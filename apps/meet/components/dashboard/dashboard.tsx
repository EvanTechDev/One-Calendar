import { CalendarClock, Video } from 'lucide-react'
import {
  getEventTitlesForMeetings,
  getMeetingSummaries,
  listRecentMeetings,
  listUpcomingEventMeetings,
} from '@zntr/meetings'
import { getDb } from '@/lib/drizzle'
import { readEventTitle } from '@/lib/event-title'
import { HomeActions } from '@/components/home-actions'
import { MeetingHistory } from '@/components/dashboard/meeting-history'
import type { MeetingRow } from '@/components/dashboard/meeting-history'

/**
 * The signed-in home: quick actions on top, then the two lists that make the
 * calendar integration visible — meetings attached to upcoming events, and
 * the user's own meeting history with duration and attendance.
 */
export async function Dashboard({ userId }: { userId: string }) {
  const db = getDb()
  const [upcoming, recent] = await Promise.all([
    listUpcomingEventMeetings(db, userId, 7),
    listRecentMeetings(db, userId, 20),
  ])

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

  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 px-6 py-10">
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Meet</h1>
        <HomeActions />
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <CalendarClock className="size-4 text-muted-foreground" />
          Next 7 days
        </h2>
        {upcoming.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            No meetings on your calendar yet. Add one from an event in Zentra
            Calendar.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {upcoming.map((item) => (
              <li
                key={item.meetingId}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {readEventTitle(item.eventId, item.title)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatWhen(item.startDate, item.endDate)}
                  </p>
                </div>
                <a
                  href={`/${item.meetingId}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                >
                  <Video className="size-3.5" />
                  Join
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <MeetingHistory rows={rows} />
    </div>
  )
}

function formatWhen(start: Date, end: Date): string {
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
