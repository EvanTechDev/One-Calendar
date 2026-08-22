import { getDb } from '@/lib/drizzle/client'
import { calendarEvents, eventInvites } from '@/lib/drizzle/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { parseInstanceId } from '@/lib/recurrence/engine'
import { canParticipantSeeOccurrence } from '@/lib/invites/visibility'
import { baselineOf, getInviteOccurrences } from '@/lib/invites/invite-service'

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
    .select()
    .from(eventInvites)
    .where(
      and(
        inArray(eventInvites.eventId, ids),
        eq(eventInvites.email, user.email.toLowerCase()),
      ),
    )
    .limit(1)

  if (!invite?.addedToCalendar) return false
  if (invite.expiresAt && invite.expiresAt <= new Date()) return false

  // An invite on the series is NOT a grant to every occurrence of it. Before
  // this check, a participant invited to a single occurrence could read any
  // occurrence through /api/bookmarks and /api/import. The visibility rule is
  // shared with every other read path — see
  // ADR-0008 (visibility is decided in one place, shared by every reader).
  const parsed = parseInstanceId(eventId)
  if (!parsed) return true

  const exceptions = await getInviteOccurrences(invite.id)
  return canParticipantSeeOccurrence(
    baselineOf(invite),
    exceptions,
    parsed.recurrenceId,
  )
}
