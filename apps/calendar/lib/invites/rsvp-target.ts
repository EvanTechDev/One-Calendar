import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/drizzle/client'
import { calendarEvents, settings } from '@/lib/drizzle/schema'
import {
  MAX_EXPANSION,
  expandSeries,
  parseRfcStamp,
} from '@/lib/recurrence/engine'
import { baselineOf, getInviteOccurrences } from '@/lib/invites/invite-service'
import { canParticipantSeeOccurrence } from '@/lib/invites/visibility'

/**
 * Deciding where an RSVP belongs, in one place for every caller.
 *
 * Both `event_invites.status` and `event_invite_occurrences.status` can hold an
 * RSVP, and which one applies depends on whether the event recurs — so the
 * decision cannot be inferred from what the client sent. See
 * ADR-0012 (an RSVP must name the occurrence it answers).
 *
 * The HTTP endpoint enforced this; the MCP tool did not, which left the very
 * bug ADR-0012 was written for reachable from the agent surface.
 */

/** The minimum of an invite row this decision needs. */
export interface RsvpGrant {
  id: string
  eventId: string
  baselineKind: string
  fromStamp: string | null
  untilStamp: string | null
}

export type RsvpTarget<G extends RsvpGrant> =
  /** A recurring event: the answer belongs on this grant's exception row. */
  | { kind: 'occurrence'; grant: G; recurrenceId: string }
  /** A non-recurring event: the invite row's own status is the answer. */
  | { kind: 'invite'; grant: G }
  /** Typed refusal, carrying the status the callers already return. */
  | { kind: 'refused'; status: 400 | 404; error: string }

/**
 * The organiser's timezone, so occurrence stamps checked here match the ones
 * written when the organiser scoped the invite. Expanding in UTC here and in
 * the organiser's zone there would put the two out of step for a series near a
 * day boundary.
 */
async function organiserTimeZone(userId: string): Promise<string | undefined> {
  const [row] = await getDb()
    .select({ data: settings.data })
    .from(settings)
    .where(eq(settings.userId, userId))
  const tz = (row?.data as { timezone?: unknown } | null)?.timezone
  return typeof tz === 'string' && tz ? tz : undefined
}

function parseRfcStampSafe(stamp: string): Date | null {
  try {
    return parseRfcStamp(stamp).date
  } catch {
    return null
  }
}

/**
 * Whether the stamp is a real occurrence of the grant's series.
 *
 * The visibility rules answer "is this occurrence allowed?", which for an
 * unbounded baseline is true of any well-formed stamp — including one the series
 * never generates. Without this check a participant could create an RSVP row for
 * a date that does not exist, which then renders as a phantom occurrence.
 */
export async function grantHasOccurrence(
  grant: { eventId: string },
  stamp: string,
): Promise<boolean> {
  const [segment] = await getDb()
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.id, grant.eventId))
  if (!segment?.rrule) return false

  const target = parseRfcStampSafe(stamp)
  if (target === null) return false

  // A narrow window around the stamp: expanding ±2 years to check one date is
  // wasteful, and the rule only needs to be asked about this instant.
  return expandSeries(
    segment,
    new Date(target.getTime() - 2 * 24 * 3600 * 1000),
    new Date(target.getTime() + 2 * 24 * 3600 * 1000),
    MAX_EXPANSION,
    await organiserTimeZone(segment.userId),
  ).some((instance) => instance.recurrenceId === stamp)
}

/**
 * Decide where an RSVP goes, given every grant sharing the participant's token.
 *
 * `grants` must be the full set (`getInvitesByToken`), not just the earliest: a
 * split copies a grant to the new master keeping the token (ADR-0009), so one
 * token addresses several segments and a tail stamp is only covered by a later
 * one. Validating against the earliest segment alone rejects legitimate answers.
 */
export async function resolveRsvpTarget<G extends RsvpGrant>(params: {
  grants: readonly G[]
  recurrenceId?: string | null
}): Promise<RsvpTarget<G>> {
  const { grants, recurrenceId } = params
  const first = grants[0]
  if (!first) {
    return { kind: 'refused', status: 404, error: 'Invite not found' }
  }

  // Which kind of event this is decides where the answer belongs. A recurring
  // event has no meaningful series-wide RSVP — each occurrence is answered
  // independently — so the stamp is required rather than optional.
  const [rsvpEvent] = await getDb()
    .select({ rrule: calendarEvents.rrule })
    .from(calendarEvents)
    .where(eq(calendarEvents.id, first.eventId))
  const isRecurringTarget = !!rsvpEvent?.rrule && rsvpEvent.rrule.trim() !== ''

  if (isRecurringTarget && !recurrenceId) {
    // The bug this guards: a caller omitted the stamp, so the write landed on
    // the invite row — which the calendar never reads — and every occurrence
    // stayed "pending" while appearing to have been answered. Guessing an
    // occurrence would be worse than refusing.
    return {
      kind: 'refused',
      status: 400,
      error: 'recurrenceId is required to RSVP to a recurring event',
    }
  }

  if (!isRecurringTarget && recurrenceId) {
    return {
      kind: 'refused',
      status: 400,
      error: 'recurrenceId is not valid for a non-recurring event',
    }
  }

  if (!recurrenceId) return { kind: 'invite', grant: first }

  // The stamp may belong to any segment the token addresses after a split, so
  // find the grant that actually covers it — and reject an uncovered stamp, or a
  // participant could RSVP to, and thereby confirm the existence of,
  // occurrences they cannot see.
  for (const grant of grants) {
    const exceptions = await getInviteOccurrences(grant.id)
    if (
      canParticipantSeeOccurrence(
        baselineOf(grant),
        exceptions,
        recurrenceId,
      ) &&
      (await grantHasOccurrence(grant, recurrenceId))
    ) {
      return { kind: 'occurrence', grant, recurrenceId }
    }
  }

  return { kind: 'refused', status: 404, error: 'Occurrence not found' }
}
