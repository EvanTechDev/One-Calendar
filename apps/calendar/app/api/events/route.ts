import { type NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth/server'
import { db } from '@/lib/drizzle/client'
import { calendarEvents } from '@/lib/drizzle/schema'
import { eq, and, gte, lte, inArray } from 'drizzle-orm'
import {
  encryptField,
  decryptField,
  encryptJsonField,
  decryptJsonField,
} from '@/lib/field-crypto'
import crypto from 'crypto'

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

function decryptEvent(event: typeof calendarEvents.$inferSelect) {
  return {
    ...event,
    title: decryptField(event.id, event.title) ?? event.title,
    description: decryptField(event.id, event.description),
    location: decryptField(event.id, event.location),
    participants: decryptJsonField(
      event.id,
      event.participants as string | null | undefined,
    ),
  }
}

async function getAuthedUser() {
  const session = await getServerSession()
  if (!session?.user) return null
  return session.user
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
    filters.push(gte(calendarEvents.startDate, new Date(startDate)))
    filters.push(lte(calendarEvents.endDate, new Date(endDate)))
  }

  if (categoryIds) {
    filters.push(inArray(calendarEvents.categoryId, categoryIds.split(',')))
  }

  const results = await db
    .select()
    .from(calendarEvents)
    .where(and(...filters))

  return NextResponse.json({ events: results.map(decryptEvent) })
}

export const POST = async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: EventInput = await request.json()
  const id = body.id ?? crypto.randomUUID()

  const [event] = await db
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

  await db
    .delete(calendarEvents)
    .where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, user.id)))

  return NextResponse.json({ success: true })
}
