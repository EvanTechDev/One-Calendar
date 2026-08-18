import { getDb } from '@/lib/drizzle/client'
import { calendarEvents, eventInvites } from '@/lib/drizzle/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { parseInstanceId } from '@/lib/recurrence/engine'

function resolveIds(eventId: string): string[] {
  const parsed = parseInstanceId(eventId)
  return parsed ? [eventId, parsed.seriesId] : [eventId]
}

export async function isEventViewableBy(
  eventId: string,
  user: { id: string; email: string },
): Promise<boolean> {
  const ids = resolveIds(eventId)
  const [owned] = await getDb()
    .select({ id: calendarEvents.id })
    .from(calendarEvents)
    .where(
      and(inArray(calendarEvents.id, ids), eq(calendarEvents.userId, user.id)),
    )
    .limit(1)
  if (owned) return true

  const [invite] = await getDb()
    .select({
      id: eventInvites.id,
      email: eventInvites.email,
      addedToCalendar: eventInvites.addedToCalendar,
      expiresAt: eventInvites.expiresAt,
    })
    .from(eventInvites)
    .where(
      and(
        inArray(eventInvites.eventId, ids),
        eq(eventInvites.email, user.email.toLowerCase()),
      ),
    )
    .limit(1)

  return (
    !!invite?.addedToCalendar &&
    (!invite.expiresAt || invite.expiresAt > new Date())
  )
}
