import { getDb } from '@/lib/drizzle/client'
import { calendarEvents, eventInvites, user } from '@/lib/drizzle/schema'
import { eq, and, inArray, desc } from 'drizzle-orm'
import { decryptEvent } from '@/lib/api-helpers'
import { ParticipantError } from './errors'
import {
  createInvitesForEvent,
  sendInviteEmails,
  getInvitesForEvent,
  resendInviteEmail,
  deleteInviteByToken,
  updateRsvp,
  removeParticipantFromCalendar,
  getInviteByToken,
} from '@/lib/invites/invite-service'

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
    baseUrl: baseUrl(),
  }
}

export async function addEventParticipants(
  userId: string,
  eventId: string,
  emails: string[],
  sendEmail: boolean = true,
) {
  const event = await getOwnedEvent(userId, eventId)
  if (!event) throw new ParticipantError('Event not found', 404)

  const uniqueEmails = normalizeEmails(emails)
  const existingInvites = await getInvitesForEvent(eventId)
  const existingEmails = new Set(existingInvites.map((i) => i.email))
  const newEmails = uniqueEmails.filter((e) => !existingEmails.has(e))
  const alreadyExists = uniqueEmails.filter((e) => existingEmails.has(e))

  if (newEmails.length > 0) {
    await createInvitesForEvent(
      eventId,
      newEmails.map((email) => ({ email })),
    )
  }

  let sent = 0
  let failed: string[] = []
  if (sendEmail && newEmails.length > 0) {
    const payload = await buildEmailPayload(event)
    const result = await sendInviteEmails({
      ...payload,
      emails: newEmails,
    })
    sent = result.sent
    failed = result.failed
  }

  return {
    event_id: eventId,
    added: newEmails,
    already_exists: alreadyExists,
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
) {
  const event = await getOwnedEvent(userId, eventId)
  if (!event) throw new ParticipantError('Event not found', 404)

  const normalized = email.trim().toLowerCase()
  const invites = await getInvitesForEvent(eventId)
  const invite = invites.find((i) => i.email === normalized)
  if (!invite) {
    throw new ParticipantError('Invite not found for this event', 404)
  }

  await deleteInviteByToken(invite.inviteToken)

  return { event_id: eventId, email: normalized, removed: true }
}

export async function listEventParticipants(userId: string, eventId: string) {
  const event = await getOwnedEvent(userId, eventId)
  if (!event) throw new ParticipantError('Event not found', 404)

  const invites = await getInvitesForEvent(eventId)
  const emails = [...new Set(invites.map((i) => i.email))]
  const users = emails.length
    ? await getDb()
        .select({ email: user.email, name: user.name, image: user.image })
        .from(user)
        .where(inArray(user.email, emails))
    : []
  const userMap = new Map(users.map((u) => [u.email.toLowerCase(), u]))

  return {
    event_id: eventId,
    participants: invites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      status: invite.status,
      email_sent: invite.emailSent,
      added_to_calendar: invite.addedToCalendar,
      user_name: userMap.get(invite.email)?.name ?? null,
      user_image: userMap.get(invite.email)?.image ?? null,
    })),
  }
}

async function getOwnInvite(userEmail: string, inviteToken: string) {
  const invite = await getInviteByToken(inviteToken)
  if (!invite) {
    throw new ParticipantError('Invite not found or expired', 404)
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
) {
  const invite = await getOwnInvite(userEmail, inviteToken)
  await updateRsvp(inviteToken, status)
  return {
    event_id: invite.eventId,
    email: invite.email,
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

  const result = invites
    .map((invite) => {
      const event = eventMap.get(invite.eventId)
      if (!event) return null
      return {
        event_id: event.id,
        title: event.title,
        start_date: event.startDate,
        end_date: event.endDate,
        is_all_day: event.isAllDay,
        color: event.color,
        location: event.location,
        category_id: event.categoryId,
        rsvp_status: invite.status,
        added_to_calendar: invite.addedToCalendar,
        invite_link: `${baseUrl()}/invite/${invite.inviteToken}`,
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
