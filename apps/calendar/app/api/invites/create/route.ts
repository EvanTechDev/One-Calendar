import { type NextRequest, NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/api-helpers'
import { getDb } from '@/lib/drizzle/client'
import { calendarEvents } from '@/lib/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { createInvitesForEvent } from '@/lib/invites/invite-service'

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

  await createInvitesForEvent(
    eventId,
    uniqueEmails.map((email) => ({ email })),
  )

  return NextResponse.json({ success: true })
}
