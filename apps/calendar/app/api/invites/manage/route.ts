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

export const runtime = 'nodejs'

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

  await deleteInviteByToken(invite.inviteToken)

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
