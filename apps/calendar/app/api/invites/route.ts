import { type NextRequest, NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/api-helpers'
import { getDb } from '@/lib/drizzle/client'
import { eventInvites, user } from '@/lib/drizzle/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { decryptField } from '@/lib/field-crypto'
import {
  sendInviteEmails,
  getInvitesForEvent,
  getOccurrencesForInvites,
  baselineOf,
  removeParticipantFromCalendar,
} from '@/lib/invites/invite-service'
import {
  canParticipantSeeOccurrence,
  rsvpForOccurrence,
  type OccurrenceException,
} from '@/lib/invites/visibility'
import {
  applyScopedParticipantChange,
  resolveParticipantTarget,
  ParticipantScopeError,
} from '@/lib/invites/scoped-invites'
import { checkFixedWindowLimit, rateLimitedResponse } from '@/lib/rate-limit'
import type { ApplyTo } from '@/lib/event-service'

const PARTICIPANT_SCOPES: ApplyTo[] = ['single', 'following', 'all']

function parseScope(value: unknown): ApplyTo | null {
  if (value === undefined || value === null) return 'all'
  return PARTICIPANT_SCOPES.includes(value as ApplyTo)
    ? (value as ApplyTo)
    : null
}

export const runtime = 'nodejs'

export const POST = async function POST(request: NextRequest) {
  const currentUser = await getAuthedUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limit = await checkFixedWindowLimit({
    name: 'invite-send',
    subject: currentUser.id,
    limit: 50,
    windowSeconds: 3600,
  })
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfter)

  const body = await request.json()
  const { eventId, emails, scope, timezone } = body as {
    eventId: string
    emails: string[]
    scope?: string
    timezone?: string
  }

  if (!eventId || !emails || !Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json(
      { error: 'Missing eventId or emails' },
      { status: 400 },
    )
  }

  const participantScope = parseScope(scope)
  if (participantScope === null) {
    return NextResponse.json({ error: 'Invalid scope' }, { status: 400 })
  }

  if (emails.length > 20) {
    return NextResponse.json(
      { error: 'Maximum 20 participants allowed' },
      { status: 400 },
    )
  }

  const uniqueEmails = [...new Set(emails.map((e) => e.toLowerCase().trim()))]
  if (uniqueEmails.length !== emails.length) {
    return NextResponse.json(
      { error: 'Duplicate emails not allowed' },
      { status: 400 },
    )
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  for (const email of uniqueEmails) {
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: `Invalid email: ${email}` },
        { status: 400 },
      )
    }
  }

  // Accepts a plain id, a series master id, or an instance id.
  const target = await resolveParticipantTarget(
    eventId,
    currentUser.id,
    timezone,
  )
  if (!target) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  let changed
  try {
    changed = await applyScopedParticipantChange({
      target,
      emails: uniqueEmails,
      scope: participantScope,
      action: 'add',
    })
  } catch (error) {
    if (error instanceof ParticipantScopeError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    throw error
  }

  const event = target.master
  const [inviter] = await getDb()
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, currentUser.id))

  const baseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
  const startStr = new Date(event.startDate).toLocaleString()
  const endStr = new Date(event.endDate).toLocaleString()

  // Only newly created invites are emailed. Widening an existing grant reuses
  // the original link, which is the point of the single-token design — see
  // ADR-0005 (participant visibility is a baseline range plus per-stamp exceptions).
  const result =
    changed.createdEmails.length > 0
      ? await sendInviteEmails({
          eventId: target.masterId,
          eventTitle: decryptField(event.id, event.title) ?? event.title,
          startDate: startStr,
          endDate: endStr,
          isAllDay: event.isAllDay,
          inviterName: inviter?.name ?? 'Someone',
          description: decryptField(event.id, event.description) ?? undefined,
          location: decryptField(event.id, event.location) ?? undefined,
          emails: changed.createdEmails,
          baseUrl,
        })
      : { sent: 0, failed: [] as string[] }

  return NextResponse.json({
    success: true,
    sent: result.sent,
    failed: result.failed,
    reused: changed.updatedEmails,
  })
}

export const GET = async function GET(request: NextRequest) {
  const currentUser = await getAuthedUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const eventId = searchParams.get('eventId')
  if (!eventId) {
    return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
  }

  // Accepts an instance id, so the preview can poll invites for an occurrence.
  const target = await resolveParticipantTarget(eventId, currentUser.id)
  if (!target) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const allInvites = await getInvitesForEvent(target.masterId)

  // Expired invites stay in the list: expiry ends the emailed link, not the
  // grant (ADR-0013). A participant whose link died before they ever joined is
  // flagged below so the organiser can resend; one who already added the event
  // holds a permanent grant and is simply a participant.
  const liveInvites = allInvites

  // `target.stamp` names the occurrence being previewed. Filter to the
  // participants of THIS occurrence and report their RSVP for it, exactly as
  // `enrichEventsWithInvites` does — the client REPLACES its correctly-filtered
  // list with this one, so an unfiltered answer silently widens it. See
  // ADR-0008 (visibility is decided in one place, shared by every reader).
  const stamp = target.stamp
  const occurrencesByInvite = stamp
    ? await getOccurrencesForInvites(liveInvites.map((i) => i.id))
    : new Map<string, OccurrenceException[]>()

  const invites = liveInvites.filter((invite) => {
    // A plain event has no stamp, so every invite applies to it.
    if (stamp === null) return true
    return canParticipantSeeOccurrence(
      baselineOf(invite),
      occurrencesByInvite.get(invite.id) ?? [],
      stamp,
    )
  })

  const emails = [...new Set(invites.map((i: { email: string }) => i.email))]
  const users = emails.length
    ? await getDb()
        .select({ email: user.email, name: user.name, image: user.image })
        .from(user)
        .where(inArray(user.email, emails))
    : []

  const userMap = users.reduce(
    (acc: Record<string, { name: string; image: string | null }>, u) => {
      acc[u.email] = { name: u.name, image: u.image }
      return acc
    },
    {} as Record<string, { name: string; image: string | null }>,
  )

  const now = new Date()
  const enrichedInvites = invites.map((invite) => ({
    ...invite,
    // RSVP is per-occurrence for a series; the invite row's own status only
    // answers for a non-recurring event (ADR-0012).
    status:
      stamp === null
        ? invite.status
        : rsvpForOccurrence(occurrencesByInvite.get(invite.id) ?? [], stamp),
    userName: userMap[invite.email]?.name ?? null,
    userImage: userMap[invite.email]?.image ?? null,
    // True exactly when the participant can no longer act: the link is dead
    // AND they never established the permanent grant. Prompts a resend, which
    // mints a fresh link window (ADR-0013).
    inviteExpired:
      !invite.addedToCalendar && !!invite.expiresAt && invite.expiresAt <= now,
  }))

  return NextResponse.json({ invites: enrichedInvites })
}

export const DELETE = async function DELETE(request: NextRequest) {
  const currentUser = await getAuthedUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const eventId = searchParams.get('eventId')
  if (!eventId) {
    return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
  }

  const [invite] = await getDb()
    .select()
    .from(eventInvites)
    .where(
      and(
        eq(eventInvites.eventId, eventId),
        eq(eventInvites.email, currentUser.email?.toLowerCase() ?? ''),
      ),
    )

  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  await removeParticipantFromCalendar(invite.inviteToken)

  return NextResponse.json({ success: true })
}
