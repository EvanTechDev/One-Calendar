import { type NextRequest, NextResponse } from 'next/server'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { getDb } from '@/lib/drizzle/client'
import { calendarEvents } from '@/lib/drizzle/schema'
import { getAuthedUser, decryptEvent } from '@/lib/api-helpers'
import { expandSeries, isSeriesEvent } from '@/lib/recurrence/engine'
import { meeting } from '@zntr/meetings'
import { meetingUrl } from '@/lib/meetings'

export const runtime = 'nodejs'

/**
 * Upcoming Event Meetings for the signed-in user — the meet dashboard's
 * "Next 7 days".
 *
 * This lives in the calendar app on purpose. The meet dashboard previously
 * filtered on the master row's `start_date`, which for a Series is the ANCHOR,
 * not an occurrence: a weekly standup anchored three months ago never appeared,
 * which is the most common business case there is. Getting that right needs
 * rrule expansion with exdates, per-occurrence overrides, and timezone-aware
 * wall-clock handling — and that logic has exactly one owner here
 * (lib/recurrence/engine). Reimplementing it behind the shared package would
 * be a second, silently-diverging copy of the subtlest code in the repo, so
 * meet fetches this instead (ADR-0017 prefers keeping a boundary over
 * duplicating an owner).
 *
 * It also keeps event-title decryption on this side, so meet no longer needs
 * the calendar's SALT to label a row.
 */

/** Cap on returned rows, mirroring listRecentMeetings' own limit. */
const MAX_ROWS = 50
const MAX_DAYS = 31

/**
 * Meet fetches this cross-origin with credentials, so it needs an explicit,
 * single allowed origin — `*` is invalid with credentials, and echoing the
 * request's Origin back would let any site read a signed-in user's calendar.
 */
function corsHeaders(request: NextRequest): Record<string, string> {
  const configured = process.env.NEXT_PUBLIC_MEET_ORIGIN
  if (!configured) return {}
  let allowed: string
  try {
    allowed = new URL(configured).origin
  } catch {
    return {}
  }
  if (request.headers.get('origin') !== allowed) return {}
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(request),
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}

export interface UpcomingMeetingRow {
  meetingId: string
  meetingUrl: string
  eventId: string
  title: string
  startDate: string
  endDate: string
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthedUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders(request) },
      )
    }

    const params = new URL(request.url).searchParams
    const requestedDays = Number(params.get('days') ?? '7')
    const days =
      Number.isFinite(requestedDays) && requestedDays > 0
        ? Math.min(Math.trunc(requestedDays), MAX_DAYS)
        : 7
    const timeZone = params.get('timezone') || undefined

    const now = new Date()
    const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    const db = getDb()
    // A Meeting attaches to the master row (ADR-0019), so this joins masters
    // only — an override never carries one.
    const rows = await db
      .select({
        meetingId: meeting.id,
        event: calendarEvents,
      })
      .from(meeting)
      .innerJoin(calendarEvents, eq(meeting.eventId, calendarEvents.id))
      .where(
        and(
          eq(calendarEvents.userId, user.id),
          // Ended meetings are not joinable, and an expired one refuses
          // tokens — neither belongs on an "upcoming" list.
          isNull(meeting.endedAt),
          or(isNull(meeting.expiresAt), gt(meeting.expiresAt, now)),
          // Deliberately NOT filtered by date here. A series master's
          // start_date is its anchor, which may be months in the past while its
          // occurrences fall inside the window — filtering on it is exactly the
          // bug this endpoint exists to fix. The window is applied per
          // occurrence below, after expansion.
        ),
      )

    const out: UpcomingMeetingRow[] = []
    for (const row of rows) {
      const event = decryptEvent(row.event)
      if (isSeriesEvent(event)) {
        // The anchor may be long past; what matters is whether an OCCURRENCE
        // falls in the window.
        const instances = expandSeries(
          {
            id: event.id,
            startDate: event.startDate,
            endDate: event.endDate,
            isAllDay: event.isAllDay,
            rrule: event.rrule,
            exdate: event.exdate,
          },
          now,
          until,
          MAX_ROWS,
          timeZone,
        )
        for (const instance of instances) {
          out.push({
            meetingId: row.meetingId,
            meetingUrl: meetingUrl(row.meetingId),
            eventId: event.id,
            title: event.title,
            startDate: instance.startDate.toISOString(),
            endDate: instance.endDate.toISOString(),
          })
        }
        continue
      }
      if (event.startDate >= now && event.startDate <= until) {
        out.push({
          meetingId: row.meetingId,
          meetingUrl: meetingUrl(row.meetingId),
          eventId: event.id,
          title: event.title,
          startDate: event.startDate.toISOString(),
          endDate: event.endDate.toISOString(),
        })
      }
    }

    out.sort((a, b) => a.startDate.localeCompare(b.startDate))
    return NextResponse.json(
      { upcoming: out.slice(0, MAX_ROWS) },
      { headers: corsHeaders(request) },
    )
  } catch (error) {
    console.error('[meetings:upcoming]', error)
    return NextResponse.json(
      { error: 'Failed to load upcoming meetings' },
      { status: 500, headers: corsHeaders(request) },
    )
  }
}
