import { type NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getAuthedUser } from '@/lib/api-helpers'
import { getDb } from '@/lib/drizzle/client'
import { calendarCategories } from '@/lib/drizzle/schema'
import {
  getGrantsByToken,
  updateRsvp,
  updateOccurrenceRsvp,
  addParticipantToCalendar,
} from '@/lib/invites/invite-service'
import { resolveRsvpTarget } from '@/lib/invites/rsvp-target'
import { firstZodMessage, inviteSelfPatchSchema } from '@/lib/validation'

export const runtime = 'nodejs'

/**
 * A participant acting on their own grant from inside the calendar.
 *
 * The token endpoint (`/api/invite/[token]`) authenticates by the token alone,
 * so it must honour link expiry — and it deliberately never reads a session
 * (plan 012's invariant). But the grant a link established outlives the link
 * (ADR-0013: the invite link expires; the grant does not), so a signed-in
 * participant RSVPing from their calendar a month later must not be refused.
 * Here the session is the credential: the caller may touch an invite exactly
 * when it is addressed to their own email. The token in the body only names
 * which invite.
 */
export const PATCH = async function PATCH(request: NextRequest) {
  const currentUser = await getAuthedUser()
  if (!currentUser?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = inviteSelfPatchSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstZodMessage(parsed.error) },
      { status: 400 },
    )
  }
  const { inviteToken, status, categoryId, recurrenceId } = parsed.data

  // Grant semantics: expiry is a property of the emailed link, not of the
  // grant, so it is deliberately not checked here.
  const grants = await getGrantsByToken(inviteToken)
  const invite = grants[0]
  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }
  if (invite.email.toLowerCase() !== currentUser.email.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (status) {
    // Where the answer belongs is decided in one place, shared with the token
    // endpoint and the MCP tool — see ADR-0012 (an RSVP must name the
    // occurrence it answers).
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
      await updateRsvp(inviteToken, status)
    }
  }

  if (categoryId !== undefined) {
    if (categoryId === '__uncategorized__') {
      await addParticipantToCalendar(inviteToken, null)
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

    await addParticipantToCalendar(inviteToken, categoryId)
  }

  return NextResponse.json({ success: true })
}
