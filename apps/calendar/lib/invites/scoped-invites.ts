import { getDb } from '@/lib/drizzle/client'
import { calendarEvents, eventInvites } from '@/lib/drizzle/schema'
import { and, eq } from 'drizzle-orm'
import {
  firstVisibleStampOfSeries,
  isInstanceId,
  parseInstanceId,
  toRfcStamp,
} from '@/lib/recurrence/engine'
import type { ApplyTo } from '@/lib/event-service'
import {
  planParticipantChange,
  ParticipantScopeError,
  type InviteVisibility,
} from '@/lib/invites/visibility'
import {
  applyParticipantChangePlan,
  baselineOf,
  createInvitesForEvent,
  getInviteOccurrences,
} from '@/lib/invites/invite-service'

/**
 * Resolving a participant change against a recurring event, shared by the API
 * routes and the MCP tools so the scope rules exist once — see
 * ADR-0008 (visibility is decided in one place, shared by every reader).
 */

export interface ResolvedTarget {
  /** The row invites attach to: the series master, or a plain event. */
  masterId: string
  master: typeof calendarEvents.$inferSelect
  /** The occurrence being acted from; null for a non-recurring event. */
  stamp: string | null
  /** The series' first visible stamp, for the `all`-scope guard. */
  firstStamp: string | null
}

/**
 * Resolves an event id — plain, master, or instance (`{seriesId}_{stamp}`) — to
 * the row that owns invites, and verifies the caller owns it.
 *
 * Passing an instance id used to 404: the old lookup compared it against
 * `calendar_events.id`, which never matches an expanded occurrence. Adding a
 * participant from an occurrence was therefore impossible.
 */
export async function resolveParticipantTarget(
  eventId: string,
  userId: string,
  timeZone?: string,
): Promise<ResolvedTarget | null> {
  const parsed = isInstanceId(eventId) ? parseInstanceId(eventId) : null
  const lookupId = parsed?.seriesId ?? eventId

  const [master] = await getDb()
    .select()
    .from(calendarEvents)
    .where(
      and(eq(calendarEvents.id, lookupId), eq(calendarEvents.userId, userId)),
    )

  if (!master) return null

  const isSeries = !!master.rrule && master.rrule.trim().length > 0
  const firstStamp = isSeries
    ? firstVisibleStampOfSeries(master, timeZone)
    : null

  // A master id for a series means "the occurrence an edit would target",
  // matching how event edits resolve the same ambiguity: the first visible
  // occurrence, falling back to the raw first stamp for a fully excluded series.
  const stamp = parsed
    ? parsed.recurrenceId
    : isSeries
      ? (firstStamp ?? toRfcStamp(new Date(master.startDate), master.isAllDay))
      : null

  return { masterId: master.id, master, stamp, firstStamp }
}

export interface ScopedParticipantResult {
  /** Emails that received a newly created invite, so an email is warranted. */
  createdEmails: string[]
  /** Emails whose existing grant was widened — no new token, no new email. */
  updatedEmails: string[]
}

/**
 * Applies a scoped add or remove for a set of emails against one target.
 *
 * The critical property, from the issue: re-adding someone who was previously
 * removed reuses their existing invite and token and sends no second email.
 */
export async function applyScopedParticipantChange(params: {
  target: ResolvedTarget
  emails: string[]
  scope: ApplyTo
  action: 'add' | 'remove'
}): Promise<ScopedParticipantResult> {
  const { target, emails, scope, action } = params
  const createdEmails: string[] = []
  const updatedEmails: string[] = []

  for (const rawEmail of emails) {
    const email = rawEmail.toLowerCase().trim()

    const [existing] = await getDb()
      .select()
      .from(eventInvites)
      .where(
        and(
          eq(eventInvites.eventId, target.masterId),
          eq(eventInvites.email, email),
        ),
      )

    const invite: InviteVisibility | null = existing
      ? baselineOf(existing)
      : null
    const exceptions = existing ? await getInviteOccurrences(existing.id) : []

    const plan = planParticipantChange(
      {
        stamp: target.stamp,
        scope,
        firstStamp: target.firstStamp,
        invite,
        exceptions,
      },
      action,
    )

    if (plan.createInvite) {
      const [created] = await createInvitesForEvent(
        target.masterId,
        [{ email }],
        plan.baseline ?? {
          baselineKind: 'all',
          fromStamp: null,
          untilStamp: null,
        },
      )
      if (!created) continue
      createdEmails.push(email)
      await applyParticipantChangePlan({
        inviteId: created.id,
        // The baseline was set at insert time; only the exceptions remain.
        plan: { ...plan, baseline: null },
      })
      continue
    }

    if (!existing) continue

    if (plan.revokeInvite) {
      // Cascade removes the occurrence rows with it.
      await getDb().delete(eventInvites).where(eq(eventInvites.id, existing.id))
      updatedEmails.push(email)
      continue
    }

    await applyParticipantChangePlan({ inviteId: existing.id, plan })
    updatedEmails.push(email)
  }

  return { createdEmails, updatedEmails }
}

export { ParticipantScopeError }
