import { type NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import { calendarEvents, eventInvites, user } from '@/lib/drizzle/schema'
import { eq, and, gte, lte, inArray } from 'drizzle-orm'
import { encryptField, encryptJsonField } from '@/lib/field-crypto'
import crypto from 'crypto'
import { getAuthedUser, decryptEvent } from '@/lib/api-helpers'
import {
  getCachedEvents,
  setCachedEvents,
  invalidateEventCache,
  groupByMonth,
} from '@/lib/cache/events'
import { fullMonthRange } from '@/lib/cache/keys'

export const runtime = 'nodejs'

type EventInput = {
  id?: string
  title: string
  description?: string | null
  location?: string | null
  startDate: string
  endDate: string
  isAllDay?: boolean
  color?: string | null
  categoryId?: string | null
  participants?: Array<{ name: string; email?: string; userId?: string }> | null
  notificationMinutes?: number | null
}

export const GET = async function GET(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const categoryIds = searchParams.get('categoryIds')

  const filters = [eq(calendarEvents.userId, user.id)]

  if (startDate && endDate) {
    const cached = await getCachedEvents(user.id, startDate, endDate)
    if (cached) {
      let events = cached.map(decryptEvent)
      if (categoryIds) {
        const ids = categoryIds.split(',')
        events = events.filter(
          (e) => e.categoryId && ids.includes(e.categoryId),
        )
      }
      return NextResponse.json({ events })
    }

    const range = fullMonthRange(startDate, endDate)
    filters.push(gte(calendarEvents.startDate, range.start))
    filters.push(lte(calendarEvents.endDate, range.end))
  }

  if (categoryIds) {
    filters.push(inArray(calendarEvents.categoryId, categoryIds.split(',')))
  }

  const results = await getDb()
    .select()
    .from(calendarEvents)
    .where(and(...filters))

  const grouped = groupByMonth(results)
  for (const [ym, monthEvents] of grouped) {
    await setCachedEvents(user.id, ym, monthEvents)
  }

  const decrypted = results.map(decryptEvent)

  const sharedEventIds = await getDb()
    .select({ eventId: eventInvites.eventId })
    .from(eventInvites)
    .where(
      and(
        eq(eventInvites.email, user.email.toLowerCase()),
        eq(eventInvites.addedToCalendar, true),
      ),
    )

  let viewOnlyEvents: ReturnType<typeof decryptEvent>[] = []
  if (sharedEventIds.length > 0) {
    const sharedIds = sharedEventIds.map((r) => r.eventId)
    const sharedResults = await getDb()
      .select()
      .from(calendarEvents)
      .where(inArray(calendarEvents.id, sharedIds))
    viewOnlyEvents = sharedResults.map((e) => ({
      ...decryptEvent(e),
      viewOnly: true,
    }))
  }

  const allEvents = [...decrypted, ...viewOnlyEvents]

  type EnrichedInvite = {
    id: string
    email: string
    status: 'pending' | 'accepted' | 'maybe' | 'declined'
    inviteToken: string
    emailSent: boolean
    addedToCalendar: boolean
    userName: string | null
    userImage: string | null
  }

  const eventIds = allEvents.map((e) => e.id)
  let invitesByEvent: Record<string, EnrichedInvite[]> = {}
  if (eventIds.length > 0) {
    const allInvites = await getDb()
      .select({
        id: eventInvites.id,
        eventId: eventInvites.eventId,
        email: eventInvites.email,
        status: eventInvites.status,
        inviteToken: eventInvites.inviteToken,
        emailSent: eventInvites.emailSent,
        addedToCalendar: eventInvites.addedToCalendar,
      })
      .from(eventInvites)
      .where(inArray(eventInvites.eventId, eventIds))

    const inviteEmails = [...new Set(allInvites.map((i) => i.email))]
    let userMap: Record<string, { name: string; image: string | null }> = {}
    if (inviteEmails.length > 0) {
      const users = await (getDb() as any)
        .select({
          email: user.email,
          name: user.name,
          image: user.image,
        })
        .from(user)
        .where(inArray(user.email as any, inviteEmails))

      userMap = (users as Array<{ email: string; name: string; image: string | null }>).reduce(
        (acc, u) => {
          acc[u.email] = { name: u.name, image: u.image }
          return acc
        },
        {} as Record<string, { name: string; image: string | null }>,
      )
    }

    invitesByEvent = allInvites.reduce(
      (acc: Record<string, EnrichedInvite[]>, invite) => {
        const enriched: EnrichedInvite = {
          id: invite.id,
          email: invite.email,
          status: invite.status as 'pending' | 'accepted' | 'maybe' | 'declined',
          inviteToken: invite.inviteToken,
          emailSent: invite.emailSent,
          addedToCalendar: invite.addedToCalendar,
          userName: userMap[invite.email]?.name ?? null,
          userImage: userMap[invite.email]?.image ?? null,
        }
        if (!acc[invite.eventId]) acc[invite.eventId] = []
        acc[invite.eventId].push(enriched)
        return acc
      },
      {} as Record<string, EnrichedInvite[]>,
    )
  }

  const eventsWithInvites = allEvents.map((e) => ({
    ...e,
    invites: invitesByEvent[e.id] ?? [],
  }))

  if (startDate && endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    return NextResponse.json({
      events: eventsWithInvites.filter(
        (e) => e.startDate >= start && e.endDate <= end,
      ),
    })
  }

  return NextResponse.json({ events: eventsWithInvites })
}

export const POST = async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: EventInput = await request.json()
  const id = body.id ?? crypto.randomUUID()

  const isUpdate = !!body.id
  if (isUpdate) {
    const [old] = await getDb()
      .select({
        startDate: calendarEvents.startDate,
        endDate: calendarEvents.endDate,
      })
      .from(calendarEvents)
      .where(eq(calendarEvents.id, id))
    if (old) {
      await invalidateEventCache(
        user.id,
        old.startDate.toISOString(),
        old.endDate.toISOString(),
      )
    }
  }

  const [event] = await getDb()
    .insert(calendarEvents)
    .values({
      id,
      userId: user.id,
      title: encryptField(id, body.title) ?? '',
      description: encryptField(id, body.description),
      location: encryptField(id, body.location),
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      isAllDay: body.isAllDay ?? false,
      color: body.color ?? null,
      categoryId: body.categoryId ?? null,
      participants: encryptJsonField(id, body.participants),
      notificationMinutes: body.notificationMinutes ?? null,
    })
    .onConflictDoUpdate({
      target: calendarEvents.id,
      set: {
        title: encryptField(id, body.title) ?? '',
        description: encryptField(id, body.description),
        location: encryptField(id, body.location),
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        isAllDay: body.isAllDay ?? false,
        color: body.color ?? null,
        categoryId: body.categoryId ?? null,
        participants: encryptJsonField(id, body.participants),
        notificationMinutes: body.notificationMinutes ?? null,
        updatedAt: new Date(),
      },
    })
    .returning()

  await invalidateEventCache(user.id, body.startDate, body.endDate)

  return NextResponse.json({ event: decryptEvent(event) })
}

export const DELETE = async function DELETE(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id } = body as { id: string }
  if (!id)
    return NextResponse.json({ error: 'Missing event id' }, { status: 400 })

  const [old] = await getDb()
    .select({
      startDate: calendarEvents.startDate,
      endDate: calendarEvents.endDate,
    })
    .from(calendarEvents)
    .where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, user.id)))

  if (!old)
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  await getDb()
    .delete(eventInvites)
    .where(eq(eventInvites.eventId, id))

  await getDb()
    .delete(calendarEvents)
    .where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, user.id)))

  await invalidateEventCache(
    user.id,
    old.startDate.toISOString(),
    old.endDate.toISOString(),
  )

  return NextResponse.json({ success: true })
}
