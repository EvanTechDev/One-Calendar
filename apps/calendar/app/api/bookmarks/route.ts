import { type NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import {
  bookmarkedEvents,
  calendarEvents,
  settings,
} from '@/lib/drizzle/schema'
import { eq, and, desc, inArray } from 'drizzle-orm'
import crypto from 'crypto'
import { getAuthedUser, decryptEvent } from '@/lib/api-helpers'
import { isEventViewableBy } from '@/lib/bookmarks'
import { getSharedEvents, type ViewEvent } from '@/lib/events/read'
import { resolveInstance, type EventRow } from '@/lib/events/service'
import {
  parseInstanceId,
  parseRfcStamp,
} from '@zntr/calendar/lib/recurrence/engine'
import { isValidTimezone } from '@zntr/calendar/lib/timezone'
import { bookmarkSchema, firstZodMessage } from '@/lib/validation'

export const runtime = 'nodejs'

type OccurrenceEvent = EventRow & {
  isOverride?: boolean
  viewOnly?: boolean
  organizer?: ViewEvent['organizer']
}

// An occurrence is not its master: expose only occurrence content and identity,
// never recurrence rules, the series anchor, or private row bookkeeping.
function safeOccurrence(event: OccurrenceEvent, eventId: string) {
  const parsed = parseInstanceId(eventId)!
  return {
    id: eventId,
    instanceId: eventId,
    title: event.title,
    description: event.description,
    location: event.location,
    startDate: event.startDate,
    endDate: event.endDate,
    isAllDay: event.isAllDay,
    status: event.status,
    color: event.color,
    participants: event.participants,
    seriesId: parsed.seriesId,
    recurrenceId: parsed.recurrenceId,
    ...(event.isOverride ? { isOverride: true } : {}),
    ...(event.viewOnly === undefined ? {} : { viewOnly: event.viewOnly }),
    ...(event.organizer === undefined ? {} : { organizer: event.organizer }),
  }
}

async function resolveTimeZone(userId: string) {
  const [row] = await getDb()
    .select({ data: settings.data })
    .from(settings)
    .where(eq(settings.userId, userId))
  const timezone = (row?.data as { timezone?: unknown } | null)?.timezone
  return typeof timezone === 'string' && isValidTimezone(timezone)
    ? timezone
    : 'UTC'
}

export const GET = async function GET() {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await getDb()
    .select()
    .from(bookmarkedEvents)
    .where(eq(bookmarkedEvents.userId, user.id))
    .orderBy(desc(bookmarkedEvents.createdAt))

  const eventIds = [
    ...new Set(
      rows.flatMap((r) => {
        const parsed = parseInstanceId(r.eventId)
        return parsed ? [r.eventId, parsed.seriesId] : [r.eventId]
      }),
    ),
  ]
  const eventRows =
    eventIds.length > 0
      ? await getDb()
          .select()
          .from(calendarEvents)
          .where(inArray(calendarEvents.id, eventIds))
      : []
  const eventById = new Map(eventRows.map((e) => [e.id, e]))
  const seriesIds = [
    ...new Set(
      rows.flatMap((row) => {
        const parsed = parseInstanceId(row.eventId)
        return parsed ? [parsed.seriesId] : []
      }),
    ),
  ]
  const overrideRows = seriesIds.length
    ? await getDb()
        .select()
        .from(calendarEvents)
        .where(inArray(calendarEvents.seriesId, seriesIds))
    : []
  const overridesBySeries = new Map<string, typeof eventRows>()
  for (const override of overrideRows) {
    if (!override.seriesId) continue
    const master = eventById.get(override.seriesId)
    if (override.userId !== master?.userId) continue
    const overrides = overridesBySeries.get(override.seriesId) ?? []
    overrides.push(override)
    overridesBySeries.set(override.seriesId, overrides)
  }
  let ownedTimeZone: Promise<string> | undefined

  const bookmarks = await Promise.all(
    rows.map(async ({ id, eventId, createdAt }) => {
      const parsed = parseInstanceId(eventId)
      if (parsed) {
        if (!(await isEventViewableBy(eventId, user))) return null
        const master = eventById.get(parsed.seriesId)
        const overrides = (overridesBySeries.get(parsed.seriesId) ?? []).filter(
          (override) => override.recurrenceId === parsed.recurrenceId,
        )
        const override = overrides[0]
        let occurrence: OccurrenceEvent | null = null
        if (master?.userId === user.id) {
          ownedTimeZone ??= resolveTimeZone(user.id)
          occurrence = resolveInstance(
            decryptEvent(master),
            parsed.recurrenceId,
            (overridesBySeries.get(parsed.seriesId) ?? []).map(decryptEvent),
            await ownedTimeZone,
          )
          if (occurrence && override) occurrence.isOverride = true
        } else {
          const stamp = parseRfcStamp(parsed.recurrenceId).date
          // A moved override lives at its new dates, not beside its stamp.
          const window = override
            ? {
                windowStart: override.startDate,
                windowEnd: new Date(override.endDate.getTime() + 1),
              }
            : {
                windowStart: new Date(stamp.getTime() - 86400000),
                windowEnd: new Date(stamp.getTime() + 86400000),
              }
          occurrence =
            (await getSharedEvents(user, window, parsed.seriesId)).find(
              (event) => event.id === eventId,
            ) ?? null
        }
        if (!occurrence) return null
        return {
          id,
          eventId,
          createdAt,
          event: safeOccurrence(occurrence, eventId),
        }
      }

      const event = eventById.get(eventId)
      if (!event) return null
      if (!(await isEventViewableBy(eventId, user))) return null
      return {
        id,
        eventId,
        createdAt,
        event: decryptEvent(event),
      }
    }),
  )

  return NextResponse.json(
    { bookmarks: bookmarks.filter(Boolean) },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

export const POST = async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bookmarkSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstZodMessage(parsed.error) },
      { status: 400 },
    )
  }
  const body = parsed.data
  if (!body.eventId)
    return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })

  if (!(await isEventViewableBy(body.eventId, user))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const id = body.id ?? crypto.randomUUID()

  const [bm] = await getDb()
    .insert(bookmarkedEvents)
    .values({
      id,
      userId: user.id,
      eventId: body.eventId,
    })
    .onConflictDoNothing()
    .returning()

  return NextResponse.json({ bookmark: bm })
}

export const DELETE = async function DELETE(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, eventId } = body as { id?: string; eventId?: string }

  if (id) {
    await getDb()
      .delete(bookmarkedEvents)
      .where(
        and(eq(bookmarkedEvents.id, id), eq(bookmarkedEvents.userId, user.id)),
      )
  } else if (eventId) {
    await getDb()
      .delete(bookmarkedEvents)
      .where(
        and(
          eq(bookmarkedEvents.eventId, eventId),
          eq(bookmarkedEvents.userId, user.id),
        ),
      )
  } else {
    return NextResponse.json(
      { error: 'Missing id or eventId' },
      { status: 400 },
    )
  }

  return NextResponse.json({ success: true })
}
