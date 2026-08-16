import { getDb } from '@/lib/drizzle/client'
import { calendarEvents, eventInvites } from '@/lib/drizzle/schema'
import { eq, and } from 'drizzle-orm'

export async function isEventViewableBy(
  eventId: string,
  user: { id: string; email: string },
): Promise<boolean> {
  const [owned] = await getDb()
    .select({ id: calendarEvents.id })
    .from(calendarEvents)
    .where(
      and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, user.id)),
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
        eq(eventInvites.eventId, eventId),
        eq(eventInvites.email, user.email.toLowerCase()),
      ),
    )
    .limit(1)

  return (
    !!invite?.addedToCalendar &&
    (!invite.expiresAt || invite.expiresAt > new Date())
  )
}
