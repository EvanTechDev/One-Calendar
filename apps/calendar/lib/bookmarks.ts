import { getDb } from '@/lib/drizzle/client'
import { calendarEvents, eventInvites } from '@/lib/drizzle/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { parseInstanceId, isSeriesEvent } from '@/lib/recurrence/engine'
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

  // `expiresAt` is deliberately not checked: it bounds the emailed link, not
  // the grant. Once the participant has added the event to their calendar the
  // grant is permanent until revoked (ADR-0013).
  if (!invite?.addedToCalendar) return false

  // An invite on the series is NOT a grant to every occurrence of it. Before
  // this check, a participant invited to a single occurrence could read any
  // occurrence through /api/bookmarks and /api/import. The visibility rule is
  // shared with every other read path — see
  // ADR-0008 (visibility is decided in one place, shared by every reader).
  const parsed = parseInstanceId(eventId)
  if (!parsed) {
    // No stamp was supplied, so there is no occurrence to check and therefore
    // no grant to honour. For a series master that is a refusal: the master row
    // carries the rrule and the exdates, and the readers here spread the whole
    // row, so admitting it would hand a participant the means to expand every
    // occurrence client-side — the leak
    // ADR-0006 (participants never receive the recurrence rule) closes
    // structurally. A plain event has no occurrences to filter, so the invite
    // alone is the grant.
    const [row] = await getDb()
      .select({ rrule: calendarEvents.rrule })
      .from(calendarEvents)
      .where(eq(calendarEvents.id, invite.eventId))
      .limit(1)
    return row ? !isSeriesEvent(row) : false
  }

  const exceptions = await getInviteOccurrences(invite.id)
  return canParticipantSeeOccurrence(
    baselineOf(invite),
    exceptions,
    parsed.recurrenceId,
  )
}
