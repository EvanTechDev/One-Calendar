import { type NextRequest, NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/api-helpers'
import { getDb } from '@/lib/drizzle/client'
import { calendarEvents, user } from '@/lib/drizzle/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { decryptField } from '@/lib/field-crypto'
import {
  createInvitesForEvent,
  sendInviteEmails,
  getInvitesForEvent,
} from '@/lib/invites/invite-service'

export const runtime = 'nodejs'

export const POST = async function POST(request: NextRequest) {
  const currentUser = await getAuthedUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { eventId, emails } = body as { eventId: string; emails: string[] }

  if (!eventId || !emails || !Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json(
      { error: 'Missing eventId or emails' },
      { status: 400 },
    )
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

  const [event] = await getDb()
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.id, eventId),
        eq(calendarEvents.userId, currentUser.id),
      ),
    )

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const existingInvites = await getInvitesForEvent(eventId)
  const existingEmails = new Set(existingInvites.map((i: { email: string }) => i.email))
  const newEmails = uniqueEmails.filter((e) => !existingEmails.has(e))

  if (newEmails.length > 0) {
    await createInvitesForEvent(
      eventId,
      newEmails.map((email) => ({ email })),
    )
  }

  const [inviter] = await getDb()
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, currentUser.id))

  const baseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
  const startStr = new Date(event.startDate).toLocaleString()
  const endStr = new Date(event.endDate).toLocaleString()

  const result = await sendInviteEmails({
    eventId,
    eventTitle: decryptField(event.id, event.title) ?? event.title,
    startDate: startStr,
    endDate: endStr,
    isAllDay: event.isAllDay,
    inviterName: inviter?.name ?? 'Someone',
    description: decryptField(event.id, event.description) ?? undefined,
    location: decryptField(event.id, event.location) ?? undefined,
    emails: uniqueEmails,
    baseUrl,
  })

  return NextResponse.json({
    success: true,
    sent: result.sent,
    failed: result.failed,
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

  const [event] = await getDb()
    .select({ id: calendarEvents.id })
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.id, eventId),
        eq(calendarEvents.userId, currentUser.id),
      ),
    )

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const invites = await getInvitesForEvent(eventId)

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

  const enrichedInvites = invites.map((invite: { email: string }) => ({
    ...invite,
    userName: userMap[invite.email]?.name ?? null,
    userImage: userMap[invite.email]?.image ?? null,
  }))

  return NextResponse.json({ invites: enrichedInvites })
}
