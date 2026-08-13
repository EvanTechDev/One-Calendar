import { type NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getDb } from '@/lib/drizzle/client'
import { calendarEvents, calendarCategories, user } from '@/lib/drizzle/schema'
import { decryptField } from '@/lib/field-crypto'
import {
  getInviteByToken,
  updateRsvp,
  addParticipantToCalendar,
  removeParticipantFromCalendar,
} from '@/lib/invites/invite-service'

export const runtime = 'nodejs'

export const GET = async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  const invite = await getInviteByToken(token)
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
    .select({ name: user.name, email: user.email })
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

  return NextResponse.json({
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
    },
    inviter: owner
      ? { name: owner.name, email: owner.email }
      : { name: 'Someone' },
    isRegisteredUser: !!participant,
    categories: participantCategories.map((cat) => ({
      id: cat.id,
      name: decryptField(cat.id, cat.name) ?? cat.name,
      color: cat.color,
    })),
  })
}

export const PATCH = async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const body = await request.json()
  const { status, categoryId } = body as {
    status?: 'pending' | 'accepted' | 'maybe' | 'declined'
    categoryId?: string
  }

  const invite = await getInviteByToken(token)
  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  if (status) {
    await updateRsvp(token, status)
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
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 },
      )
    }

    await addParticipantToCalendar(token, categoryId)
  }

  return NextResponse.json({ success: true })
}

export const DELETE = async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  const invite = await getInviteByToken(token)
  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  await removeParticipantFromCalendar(token)

  return NextResponse.json({ success: true })
}
