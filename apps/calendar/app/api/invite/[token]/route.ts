import { type NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getDb } from '@/lib/drizzle/client'
import {
  calendarEvents,
  calendarCategories,
  settings,
  user,
} from '@/lib/drizzle/schema'
import { decryptField } from '@/lib/field-crypto'
import {
  getInviteByToken,
  getInvitesByToken,
  updateRsvp,
  addParticipantToCalendar,
  removeParticipantFromCalendar,
  baselineOf,
  getInviteOccurrences,
  updateOccurrenceRsvp,
} from '@/lib/invites/invite-service'
import {
  canParticipantSeeOccurrence,
  rsvpForOccurrence,
} from '@/lib/invites/visibility'
import {
  DEFAULT_EXPANSION_WINDOW_MS,
  MAX_EXPANSION,
  describeRecurrence,
  expandSeries,
  parseRfcStamp,
} from '@/lib/recurrence/engine'
import { firstZodMessage, invitePatchSchema } from '@/lib/validation'
import {
  checkFixedWindowLimit,
  clientIpFrom,
  rateLimitedResponse,
} from '@/lib/rate-limit'

export const runtime = 'nodejs'

/**
 * The organiser's timezone, so occurrence stamps shown to a participant match
 * the ones written when the organiser scoped their invite. Expanding in UTC here
 * and in the organiser's zone there would put the two out of step for a series
 * near a day boundary.
 */
async function organiserTimeZone(userId: string): Promise<string | undefined> {
  const [row] = await getDb()
    .select({ data: settings.data })
    .from(settings)
    .where(eq(settings.userId, userId))
  const tz = (row?.data as { timezone?: unknown } | null)?.timezone
  return typeof tz === 'string' && tz ? tz : undefined
}

/**
 * Whether the stamp is a real occurrence of the grant's series.
 *
 * The visibility rules answer "is this occurrence allowed?", which for an
 * unbounded baseline is true of any well-formed stamp — including one the series
 * never generates. Without this check a participant could create an RSVP row for
 * a date that does not exist, which then renders as a phantom occurrence.
 */
async function grantHasOccurrence(
  grant: { eventId: string },
  stamp: string,
): Promise<boolean> {
  const [segment] = await getDb()
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.id, grant.eventId))
  if (!segment?.rrule) return false

  const target = parseRfcStampSafe(stamp)
  if (target === null) return false

  // A narrow window around the stamp: expanding ±2 years to check one date is
  // wasteful, and the rule only needs to be asked about this instant.
  return expandSeries(
    segment,
    new Date(target.getTime() - 2 * 24 * 3600 * 1000),
    new Date(target.getTime() + 2 * 24 * 3600 * 1000),
    MAX_EXPANSION,
    await organiserTimeZone(segment.userId),
  ).some((instance) => instance.recurrenceId === stamp)
}

function parseRfcStampSafe(stamp: string): Date | null {
  try {
    return parseRfcStamp(stamp).date
  } catch {
    return null
  }
}

/**
 * The invite link is deliberately public and anonymous, so the only available
 * subject is the client IP — a speed bump, not a guarantee (see lib/rate-limit).
 * The point is to stop an unmetered, unauthenticated endpoint that decrypts
 * fields and hits the database several times per call from being free to hammer.
 */
async function inviteRateLimit(request: NextRequest): Promise<Response | null> {
  const limit = await checkFixedWindowLimit({
    name: 'invite-token',
    subject: clientIpFrom(request),
    limit: 60,
    windowSeconds: 60,
  })
  return limit.allowed ? null : rateLimitedResponse(limit.retryAfter)
}

export const GET = async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const limited = await inviteRateLimit(request)
  if (limited) return limited

  const { token } = await params

  const grants = await getInvitesByToken(token)
  const invite = grants[0]
  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  const [event] = await getDb()
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.id, invite.eventId))

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const [owner] = await getDb()
    .select({ name: user.name, image: user.image })
    .from(user)
    .where(eq(user.id, event.userId))

  const [participant] = invite.email
    ? await getDb()
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(eq(user.email, invite.email.toLowerCase().trim()))
        .limit(1)
    : []

  const participantCategories = participant
    ? await getDb()
        .select({
          id: calendarCategories.id,
          name: calendarCategories.name,
          color: calendarCategories.color,
        })
        .from(calendarCategories)
        .where(eq(calendarCategories.userId, participant.id))
        .orderBy(calendarCategories.sortOrder)
    : []

  // A recurring event resolves to the occurrences THIS token grants, each with
  // its own RSVP. The rrule is never returned — a participant who holds the
  // rule can generate occurrences they were not granted. See
  // ADR-0006 (participants never receive the recurrence rule).
  const isSeries = !!event.rrule && event.rrule.trim().length > 0
  type GrantedOccurrence = {
    recurrenceId: string
    startDate: Date
    endDate: Date
    status: string
  }
  let occurrences: GrantedOccurrence[] | null = null
  let recurrenceSummary: string | null = null

  if (isSeries) {
    recurrenceSummary = describeRecurrence(event.rrule!, false)
    const timeZone = await organiserTimeZone(event.userId)
    const collected: GrantedOccurrence[] = []

    // A split leaves one token addressing several masters — the segments of what
    // the participant sees as one series (ADR-0009). Union them, or a split
    // silently hides the tail from the person who was invited to it.
    for (const grant of grants) {
      const [segment] =
        grant.eventId === event.id
          ? [event]
          : await getDb()
              .select()
              .from(calendarEvents)
              .where(eq(calendarEvents.id, grant.eventId))
      if (!segment?.rrule) continue

      const exceptions = await getInviteOccurrences(grant.id)
      const baseline = baselineOf(grant)

      for (const instance of expandSeries(
        segment,
        new Date(Date.now() - DEFAULT_EXPANSION_WINDOW_MS),
        new Date(Date.now() + DEFAULT_EXPANSION_WINDOW_MS),
        MAX_EXPANSION,
        // The organiser's timezone, so these stamps match the ones written when
        // the organiser scoped the invite.
        timeZone,
      )) {
        if (
          !canParticipantSeeOccurrence(
            baseline,
            exceptions,
            instance.recurrenceId,
          )
        ) {
          continue
        }
        collected.push({
          recurrenceId: instance.recurrenceId,
          startDate: instance.startDate,
          endDate: instance.endDate,
          status: rsvpForOccurrence(exceptions, instance.recurrenceId),
        })
      }
    }

    collected.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    occurrences = collected
  }

  return NextResponse.json(
    {
      invite: {
        id: invite.id,
        email: invite.email,
        status: invite.status,
        addedToCalendar: invite.addedToCalendar,
      },
      event: {
        id: event.id,
        title: decryptField(event.id, event.title) ?? event.title,
        description: decryptField(event.id, event.description),
        location: decryptField(event.id, event.location),
        startDate: event.startDate,
        endDate: event.endDate,
        isAllDay: event.isAllDay,
        color: event.color,
        /** Human-readable only. Deliberately not the rrule. */
        recurrenceSummary,
      },
      /** Null for a non-recurring event. */
      occurrences,
      // The invite page renders only the inviter's name and avatar. Returning
      // the organiser's email address to anyone holding a forwarded link is
      // disclosure with no purpose.
      inviter: owner
        ? { name: owner.name, image: owner.image }
        : { name: 'Someone' },
      isRegisteredUser: !!participant,
      categories: participantCategories.map((cat) => ({
        id: cat.id,
        name: decryptField(cat.id, cat.name) ?? cat.name,
        color: cat.color,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export const PATCH = async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const limited = await inviteRateLimit(request)
  if (limited) return limited

  const { token } = await params

  const parsed = invitePatchSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstZodMessage(parsed.error) },
      { status: 400 },
    )
  }
  const { status, categoryId, recurrenceId } = parsed.data

  const grants = await getInvitesByToken(token)
  const invite = grants[0]
  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  if (status) {
    // Which kind of event this is decides where the answer belongs. A recurring
    // event has no meaningful series-wide RSVP — each occurrence is answered
    // independently — so the stamp is required rather than optional.
    const [rsvpEvent] = await getDb()
      .select({ rrule: calendarEvents.rrule })
      .from(calendarEvents)
      .where(eq(calendarEvents.id, invite.eventId))
    const isRecurringTarget =
      !!rsvpEvent?.rrule && rsvpEvent.rrule.trim().length > 0

    if (isRecurringTarget && !recurrenceId) {
      // The bug this guards: the calendar UI omitted the stamp, so the write
      // landed on the invite row — which the calendar never reads — and every
      // occurrence stayed "pending" while appearing to have been answered.
      // Guessing an occurrence would be worse than refusing.
      return NextResponse.json(
        { error: 'recurrenceId is required to RSVP to a recurring event' },
        { status: 400 },
      )
    }

    if (!isRecurringTarget && recurrenceId) {
      return NextResponse.json(
        { error: 'recurrenceId is not valid for a non-recurring event' },
        { status: 400 },
      )
    }

    if (recurrenceId) {
      // The stamp may belong to any segment the token addresses after a split,
      // so find the grant that actually covers it — and reject an uncovered
      // stamp, or a participant could RSVP to, and thereby confirm the
      // existence of, occurrences they cannot see.
      let target: { id: string } | null = null
      for (const grant of grants) {
        const exceptions = await getInviteOccurrences(grant.id)
        if (
          canParticipantSeeOccurrence(
            baselineOf(grant),
            exceptions,
            recurrenceId,
          ) &&
          (await grantHasOccurrence(grant, recurrenceId))
        ) {
          target = grant
          break
        }
      }
      if (!target) {
        return NextResponse.json(
          { error: 'Occurrence not found' },
          { status: 404 },
        )
      }
      await updateOccurrenceRsvp({
        inviteId: target.id,
        recurrenceId,
        status,
        visible: true,
      })
    } else {
      await updateRsvp(token, status)
    }
  }

  if (categoryId !== undefined) {
    const [event] = await getDb()
      .select({ userId: calendarEvents.userId })
      .from(calendarEvents)
      .where(eq(calendarEvents.id, invite.eventId))

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const [participant] = await getDb()
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, invite.email.toLowerCase().trim()))
      .limit(1)

    if (!participant) {
      return NextResponse.json(
        { error: 'Participant is not a registered user' },
        { status: 400 },
      )
    }

    if (categoryId === '__uncategorized__') {
      await addParticipantToCalendar(token, null)
      return NextResponse.json({ success: true })
    }

    const [cat] = await getDb()
      .select({ id: calendarCategories.id })
      .from(calendarCategories)
      .where(
        and(
          eq(calendarCategories.id, categoryId),
          eq(calendarCategories.userId, participant.id),
        ),
      )

    if (!cat) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    await addParticipantToCalendar(token, categoryId)
  }

  return NextResponse.json({ success: true })
}

export const DELETE = async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const limited = await inviteRateLimit(request)
  if (limited) return limited

  const { token } = await params

  const invite = await getInviteByToken(token)
  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  await removeParticipantFromCalendar(token)

  return NextResponse.json({ success: true })
}
