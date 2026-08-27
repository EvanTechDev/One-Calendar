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
import { getMeetingForEvent } from '@zntr/meetings'
import { meetingUrl } from '@/lib/meetings'
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
} from '@/lib/recurrence/engine'
import { resolveRsvpTarget } from '@/lib/invites/rsvp-target'
import { firstZodMessage, invitePatchSchema } from '@/lib/validation'
import {
  checkFixedWindowLimit,
  clientIpFrom,
  rateLimitedResponse,
} from '@/lib/rate-limit'
import { getAuthedUser } from '@/lib/api-helpers'

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

  const currentUser = await getAuthedUser()
  const isMatchingParticipant =
    !!currentUser?.email &&
    currentUser.email.toLowerCase().trim() === invite.email.toLowerCase().trim()

  const participantCategories = isMatchingParticipant
    ? await getDb()
        .select({
          id: calendarCategories.id,
          name: calendarCategories.name,
          color: calendarCategories.color,
        })
        .from(calendarCategories)
        .where(eq(calendarCategories.userId, currentUser.id))
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

  // A Series carries its Meeting on the master row (ADR-0019).
  const eventMeeting = await getMeetingForEvent(
    getDb(),
    event.seriesId ?? event.id,
  )

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
        /**
         * The Event Meeting's join link, when one is attached. Holding the
         * link is what admits someone to a meeting (ADR-0019); the invite
         * token's only role here is revealing it.
         */
        meetingUrl: eventMeeting ? meetingUrl(eventMeeting.id) : null,
      },
      /** Null for a non-recurring event. */
      occurrences,
      // The invite page renders only the inviter's name and avatar. Returning
      // the organiser's email address to anyone holding a forwarded link is
      // disclosure with no purpose.
      inviter: owner
        ? { name: owner.name, image: owner.image }
        : { name: 'Someone' },
      isRegisteredUser: isMatchingParticipant,
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
    // Where the answer belongs is decided in one place, shared with the MCP
    // tool — see ADR-0012 (an RSVP must name the occurrence it answers).
    const target = await resolveRsvpTarget({ grants, recurrenceId })
    if (target.kind === 'refused') {
      return NextResponse.json(
        { error: target.error },
        { status: target.status },
      )
    }

    if (target.kind === 'occurrence') {
      await updateOccurrenceRsvp({
        inviteId: target.grant.id,
        recurrenceId: target.recurrenceId,
        status,
        visible: true,
      })
    } else {
      await updateRsvp(token, status)
    }
  }

  if (categoryId !== undefined) {
    const currentUser = await getAuthedUser()
    if (!currentUser?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      )
    }
    if (
      currentUser.email.toLowerCase().trim() !==
      invite.email.toLowerCase().trim()
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
          eq(calendarCategories.userId, currentUser.id),
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
