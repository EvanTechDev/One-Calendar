import { type NextRequest, NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/api-helpers'
import { getDb } from '@/lib/drizzle/client'
import { calendarEvents, eventInvites, user } from '@/lib/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { decryptField } from '@/lib/field-crypto'
import {
  deleteInviteByToken,
  resendInviteEmail,
} from '@/lib/invites/invite-service'
import {
  applyScopedParticipantChange,
  resolveParticipantTarget,
  ParticipantScopeError,
} from '@/lib/invites/scoped-invites'
import type { ApplyTo } from '@/lib/event-service'

export const runtime = 'nodejs'

const PARTICIPANT_SCOPES: ApplyTo[] = ['single', 'following', 'all']

export const DELETE = async function DELETE(request: NextRequest) {
  const currentUser = await getAuthedUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const inviteId = searchParams.get('id')
  if (!inviteId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  // Which occurrences to remove the participant from. Without this the only
  // possible removal was series-wide, so the issue's "remove c from this and
  // following" step was unreachable from the product.
  const scopeParam = searchParams.get('scope')
  const scope: ApplyTo = scopeParam === null ? 'all' : (scopeParam as ApplyTo)
  if (!PARTICIPANT_SCOPES.includes(scope)) {
    return NextResponse.json({ error: 'Invalid scope' }, { status: 400 })
  }
  // The occurrence the organiser is acting from, for a scoped removal.
  const occurrenceId = searchParams.get('occurrenceId')

  const [invite] = await getDb()
    .select()
    .from(eventInvites)
    .where(eq(eventInvites.id, inviteId))

  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  const [event] = await getDb()
    .select({ id: calendarEvents.id })
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.id, invite.eventId),
        eq(calendarEvents.userId, currentUser.id),
      ),
    )

  if (!event) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 'all' on a non-recurring event is just "remove them", which the old path
  // did directly; keep that cheap and avoid loading the series machinery.
  if (scope === 'all' && occurrenceId === null) {
    await deleteInviteByToken(invite.inviteToken)
    return NextResponse.json({ success: true })
  }

  const target = await resolveParticipantTarget(
    occurrenceId ?? invite.eventId,
    currentUser.id,
  )
  if (!target) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  try {
    await applyScopedParticipantChange({
      target,
      emails: [invite.email],
      scope,
      action: 'remove',
    })
  } catch (error) {
    if (error instanceof ParticipantScopeError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    throw error
  }

  return NextResponse.json({ success: true })
}

export const POST = async function POST(request: NextRequest) {
  const currentUser = await getAuthedUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { inviteId } = body as { inviteId: string }
  if (!inviteId) {
    return NextResponse.json({ error: 'Missing inviteId' }, { status: 400 })
  }

  const [invite] = await getDb()
    .select()
    .from(eventInvites)
    .where(eq(eventInvites.id, inviteId))

  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  const [event] = await getDb()
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.id, invite.eventId),
        eq(calendarEvents.userId, currentUser.id),
      ),
    )

  if (!event) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [inviter] = await getDb()
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, currentUser.id))

  const baseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
  const startStr = new Date(event.startDate).toLocaleString()
  const endStr = new Date(event.endDate).toLocaleString()

  const success = await resendInviteEmail({
    eventId: event.id,
    eventTitle: decryptField(event.id, event.title) ?? event.title,
    startDate: startStr,
    endDate: endStr,
    isAllDay: event.isAllDay,
    inviterName: inviter?.name ?? 'Someone',
    description: decryptField(event.id, event.description) ?? undefined,
    location: decryptField(event.id, event.location) ?? undefined,
    email: invite.email,
    baseUrl,
  })

  return NextResponse.json({ success })
}
