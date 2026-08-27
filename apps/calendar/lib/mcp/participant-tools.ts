import { getDb } from '@/lib/drizzle/client'
import { calendarEvents, eventInvites, user } from '@/lib/drizzle/schema'
import { eq, and, inArray, desc } from 'drizzle-orm'
import { decryptEvent } from '@/lib/api-helpers'
import { ParticipantError } from './errors'
import {
  sendInviteEmails,
  getInvitesForEvent,
  resendInviteEmail,
  updateRsvp,
  removeParticipantFromCalendar,
  getGrantsByToken,
  baselineOf,
  getInviteOccurrences,
  getOccurrencesForInvites,
  readInviteToken,
  updateOccurrenceRsvp,
} from '@/lib/invites/invite-service'
import { resolveRsvpTarget } from '@/lib/invites/rsvp-target'
import { resolveMeetingUrl } from '@/lib/invites/meeting-link'
import { isSeriesEvent } from '@/lib/recurrence/engine'
import {
  applyScopedParticipantChange,
  resolveParticipantTarget,
} from '@/lib/invites/scoped-invites'
import {
  canParticipantSeeOccurrence,
  rsvpForOccurrence,
  ParticipantScopeError,
} from '@/lib/invites/visibility'
import type { ApplyTo } from '@/lib/event-service'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_PARTICIPANTS = 20

function normalizeEmails(emails: string[]): string[] {
  if (emails.length === 0) {
    throw new ParticipantError('emails must not be empty')
  }
  if (emails.length > MAX_PARTICIPANTS) {
    throw new ParticipantError(
      `Maximum ${MAX_PARTICIPANTS} participants allowed`,
    )
  }
  const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()))]
  if (unique.length !== emails.length) {
    throw new ParticipantError('Duplicate emails not allowed')
  }
  for (const email of unique) {
    if (!EMAIL_REGEX.test(email)) {
      throw new ParticipantError(`Invalid email: ${email}`)
    }
  }
  return unique
}

export async function getUserEmail(userId: string): Promise<string> {
  const db = await getDb()
  const [row] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
  return row?.email?.toLowerCase() ?? ''
}

export async function getOwnedEvent(userId: string, eventId: string) {
  const db = await getDb()
  const [row] = await db
    .select()
    .from(calendarEvents)
    .where(
      and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)),
    )
  return row ? decryptEvent(row) : null
}

function baseUrl(): string {
  return process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
}

async function buildEmailPayload(event: ReturnType<typeof decryptEvent>) {
  const db = await getDb()
  const [inviter] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, event.userId))
  const startStr = new Date(event.startDate).toLocaleString()
  const endStr = new Date(event.endDate).toLocaleString()
  return {
    eventId: event.id,
    eventTitle: event.title,
    startDate: startStr,
    endDate: endStr,
    isAllDay: event.isAllDay,
    inviterName: inviter?.name ?? 'Someone',
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    // Both the first send and the resend flow through here, so the meeting
    // link cannot go missing from one of them.
    meetingUrl: await resolveMeetingUrl(event.id),
    baseUrl: baseUrl(),
  }
}

export async function addEventParticipants(
  userId: string,
  eventId: string,
  emails: string[],
  sendEmail: boolean = true,
  /**
   * Which occurrences the participants apply to. Routed through the same shared
   * module the API uses, so an agent cannot bypass the visibility model — see
   * ADR-0008 (visibility is decided in one place, shared by every reader).
   */
  scope: ApplyTo = 'all',
) {
  const target = await resolveParticipantTarget(eventId, userId)
  if (!target) throw new ParticipantError('Event not found', 404)

  const uniqueEmails = normalizeEmails(emails)

  let changed
  try {
    changed = await applyScopedParticipantChange({
      target,
      emails: uniqueEmails,
      scope,
      action: 'add',
    })
  } catch (error) {
    if (error instanceof ParticipantScopeError) {
      throw new ParticipantError(error.message, 400)
    }
    throw error
  }

  let sent = 0
  let failed: string[] = []
  // Only a brand-new invite warrants an email; widening an existing grant
  // reuses the participant's original link.
  if (sendEmail && changed.createdEmails.length > 0) {
    const event = await getOwnedEvent(userId, target.masterId)
    if (event) {
      const payload = await buildEmailPayload(event)
      const result = await sendInviteEmails({
        ...payload,
        emails: changed.createdEmails,
      })
      sent = result.sent
      failed = result.failed
    }
  }

  return {
    event_id: target.masterId,
    added: changed.createdEmails,
    already_exists: changed.updatedEmails,
    email_sent: sendEmail,
    sent,
    failed,
  }
}

export async function resendEventInvite(
  userId: string,
  eventId: string,
  email: string,
) {
  const event = await getOwnedEvent(userId, eventId)
  if (!event) throw new ParticipantError('Event not found', 404)

  const normalized = email.trim().toLowerCase()
  const invite = await getInvitesForEvent(eventId)
  if (!invite.some((i) => i.email === normalized)) {
    throw new ParticipantError('Invite not found for this event', 404)
  }

  const payload = await buildEmailPayload(event)
  const sent = await resendInviteEmail({ ...payload, email: normalized })

  return { event_id: eventId, email: normalized, sent }
}

export async function removeEventParticipant(
  userId: string,
  eventId: string,
  email: string,
  scope: ApplyTo = 'all',
) {
  const target = await resolveParticipantTarget(eventId, userId)
  if (!target) throw new ParticipantError('Event not found', 404)

  const normalized = email.trim().toLowerCase()
  const invites = await getInvitesForEvent(target.masterId)
  if (!invites.some((i) => i.email === normalized)) {
    throw new ParticipantError('Invite not found for this event', 404)
  }

  try {
    await applyScopedParticipantChange({
      target,
      emails: [normalized],
      scope,
      action: 'remove',
    })
  } catch (error) {
    if (error instanceof ParticipantScopeError) {
      throw new ParticipantError(error.message, 400)
    }
    throw error
  }

  return { event_id: target.masterId, email: normalized, removed: true }
}

export async function listEventParticipants(userId: string, eventId: string) {
  const target = await resolveParticipantTarget(eventId, userId)
  if (!target) throw new ParticipantError('Event not found', 404)

  const invites = await getInvitesForEvent(target.masterId)
  const emails = [...new Set(invites.map((i) => i.email))]
  const users = emails.length
    ? await getDb()
        .select({ email: user.email, name: user.name, image: user.image })
        .from(user)
        .where(inArray(user.email, emails))
    : []
  const userMap = new Map(users.map((u) => [u.email.toLowerCase(), u]))

  // For a recurring event, report the participants of THIS occurrence and their
  // RSVP for it — a series-wide answer would misreport both.
  const stamp = target.stamp
  const participants: Array<Record<string, unknown>> = []

  for (const invite of invites) {
    const exceptions = stamp ? await getInviteOccurrences(invite.id) : []
    if (
      stamp &&
      !canParticipantSeeOccurrence(baselineOf(invite), exceptions, stamp)
    ) {
      continue
    }
    participants.push({
      id: invite.id,
      email: invite.email,
      status: stamp ? rsvpForOccurrence(exceptions, stamp) : invite.status,
      email_sent: invite.emailSent,
      added_to_calendar: invite.addedToCalendar,
      user_name: userMap.get(invite.email)?.name ?? null,
      user_image: userMap.get(invite.email)?.image ?? null,
    })
  }

  return {
    event_id: target.masterId,
    occurrence: stamp,
    participants,
  }
}

async function getOwnInvite(userEmail: string, inviteToken: string) {
  // Grant semantics: the caller is authenticated by their MCP session and the
  // email check below, so the emailed link's expiry does not apply — the grant
  // outlives the link (ADR-0013).
  const [invite] = await getGrantsByToken(inviteToken)
  if (!invite) {
    throw new ParticipantError('Invite not found', 404)
  }
  if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new ParticipantError(
      'Forbidden: invite does not belong to the authenticated user',
      403,
    )
  }
  return invite
}

export async function updateInviteRsvp(
  userEmail: string,
  inviteToken: string,
  status: 'pending' | 'accepted' | 'maybe' | 'declined',
  /** RFC stamp of the occurrence being answered, for a recurring event. */
  recurrenceId?: string,
) {
  // Every segment sharing the token, not just the earliest: a split copies a
  // grant to the new master keeping the token (ADR-0009), so a tail stamp is
  // only covered by a later segment. `getInviteByToken` returns the earliest,
  // so validating against it alone rejected legitimate answers.
  //
  // Grant semantics (`getGrantsByToken`): the email check below is the
  // credential here, so link expiry does not apply (ADR-0013).
  const grants = await getGrantsByToken(inviteToken)
  const owned = grants[0]
  if (!owned) {
    throw new ParticipantError('Invite not found', 404)
  }
  if (owned.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new ParticipantError(
      'Forbidden: invite does not belong to the authenticated user',
      403,
    )
  }

  // Where the answer belongs is decided in one place, shared with the HTTP
  // endpoint — see ADR-0012 (an RSVP must name the occurrence it answers).
  const target = await resolveRsvpTarget({ grants, recurrenceId })
  if (target.kind === 'refused') {
    throw new ParticipantError(target.error, target.status)
  }

  if (target.kind === 'occurrence') {
    await updateOccurrenceRsvp({
      inviteId: target.grant.id,
      recurrenceId: target.recurrenceId,
      status,
      visible: true,
    })
  } else {
    await updateRsvp(inviteToken, status)
  }

  return {
    event_id: target.grant.eventId,
    email: owned.email,
    occurrence: recurrenceId ?? null,
    status,
  }
}

export async function removeEventFromMyCalendar(
  userEmail: string,
  inviteToken: string,
) {
  const invite = await getOwnInvite(userEmail, inviteToken)
  await removeParticipantFromCalendar(inviteToken)
  return {
    event_id: invite.eventId,
    email: invite.email,
    removed_from_calendar: true,
  }
}

export async function listMyEventInvites(
  userEmail: string,
  status?: 'pending' | 'accepted' | 'maybe' | 'declined',
) {
  const db = await getDb()
  const normalized = userEmail.toLowerCase()

  const filters = [eq(eventInvites.email, normalized)]
  if (status) filters.push(eq(eventInvites.status, status))

  const invites = await db
    .select()
    .from(eventInvites)
    .where(and(...filters))
    .orderBy(desc(eventInvites.createdAt))

  if (invites.length === 0) return { invites: [] }

  const eventIds = [...new Set(invites.map((i) => i.eventId))]
  const events = await db
    .select()
    .from(calendarEvents)
    .where(inArray(calendarEvents.id, eventIds))

  const eventMap = new Map(events.map((e) => [e.id, decryptEvent(e)]))

  // A series' answers live per occurrence; `event_invites.status` is meaningful
  // only for a non-recurring event — see
  // ADR-0012 (an RSVP must name the occurrence it answers). Reporting the
  // column for a series showed one value, usually "pending", for every date the
  // participant had actually answered.
  const exceptionsByInvite = await getOccurrencesForInvites(
    invites
      .filter((i) =>
        isSeriesEvent({ rrule: eventMap.get(i.eventId)?.rrule ?? null }),
      )
      .map((i) => i.id),
  )

  const result = invites
    .map((invite) => {
      const event = eventMap.get(invite.eventId)
      if (!event) return null
      const recurring = isSeriesEvent({ rrule: event.rrule })
      return {
        event_id: event.id,
        title: event.title,
        start_date: event.startDate,
        end_date: event.endDate,
        is_all_day: event.isAllDay,
        color: event.color,
        location: event.location,
        category_id: event.categoryId,
        recurring,
        rsvp_status: recurring ? null : invite.status,
        occurrence_rsvps: recurring
          ? (exceptionsByInvite.get(invite.id) ?? [])
              // Only answered occurrences: a hidden exception carries no answer
              // worth reporting, and an unanswered one is "pending" by default.
              .filter((e) => e.visible)
              .map((e) => ({
                recurrence_id: e.recurrenceId,
                rsvp_status: e.status ?? 'pending',
              }))
              .sort((a, b) =>
                a.recurrence_id < b.recurrence_id
                  ? -1
                  : a.recurrence_id > b.recurrence_id
                    ? 1
                    : 0,
              )
          : null,
        added_to_calendar: invite.addedToCalendar,
        invite_link: `${baseUrl()}/invite/${readInviteToken(invite)}`,
        expires_at: invite.expiresAt,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  result.sort((a, b) => {
    const aTime = new Date(a.start_date).getTime()
    const bTime = new Date(b.start_date).getTime()
    if (aTime !== bTime) return bTime - aTime
    return a.event_id < b.event_id ? -1 : 1
  })

  return { invites: result }
}
