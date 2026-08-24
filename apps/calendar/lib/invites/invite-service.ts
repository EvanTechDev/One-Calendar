import crypto from 'crypto'
import { eq, and, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/drizzle/client'
import { eventInvites, eventInviteOccurrences } from '@/lib/drizzle/schema'
import { sendAuthEmail } from '@/lib/auth/send-auth-email'
import { buildInvitationEmail } from '@/lib/email/invitation-template'
import {
  type InviteVisibility,
  type OccurrenceException,
  type RsvpStatus,
  type ParticipantChangePlan,
  type BaselineKind,
} from '@/lib/invites/visibility'

async function sendEmail(payload: {
  to: string
  subject: string
  html: string
}) {
  await sendAuthEmail(payload)
}

/**
 * How long an emailed invite link works. The link is a bearer credential and
 * this bounds the damage of a forwarded email; the grant it establishes is
 * permanent once the participant adds the event to their calendar — see
 * ADR-0013 (the invite link expires; the grant does not).
 */
export const INVITE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface ParticipantInput {
  email: string
}

export interface InviteResult {
  id: string
  email: string
  token: string
  status: RsvpStatus
}

export async function createInvitesForEvent(
  eventId: string,
  participants: ParticipantInput[],
  /**
   * Baseline visibility for the new invites. Defaults to the whole event, which
   * is right for a non-recurring event and for `all` scope. A participant added
   * at `single` scope gets an empty baseline plus one exception instead — see
   * ADR-0005 (participant visibility is a baseline range plus per-stamp exceptions).
   */
  baseline: InviteVisibility = {
    baselineKind: 'all',
    fromStamp: null,
    untilStamp: null,
  },
): Promise<InviteResult[]> {
  if (participants.length === 0) return []

  const db = getDb()
  const rows = participants.map((p) => ({
    id: crypto.randomUUID(),
    eventId,
    email: p.email.toLowerCase().trim(),
    status: 'pending' as const,
    inviteToken: crypto.randomUUID(),
    emailSent: false,
    addedToCalendar: false,
    categoryId: null,
    baselineKind: baseline.baselineKind,
    fromStamp: baseline.fromStamp,
    untilStamp: baseline.untilStamp,
    expiresAt: new Date(Date.now() + INVITE_LINK_TTL_MS),
    createdAt: new Date(),
    updatedAt: new Date(),
  }))

  const inserted = await db
    .insert(eventInvites)
    .values(rows)
    // The unique (event_id, email) index makes concurrent adds safe; a losing
    // race keeps the existing grant and its token rather than erroring.
    .onConflictDoNothing({
      target: [eventInvites.eventId, eventInvites.email],
    })
    .returning()

  return inserted.map((r) => ({
    id: r.id,
    email: r.email,
    token: r.inviteToken,
    status: r.status as RsvpStatus,
  }))
}

export async function sendInviteEmails(params: {
  eventId: string
  eventTitle: string
  startDate: string
  endDate: string
  isAllDay: boolean
  inviterName: string
  inviterEmail?: string
  description?: string
  location?: string
  emails: string[]
  baseUrl: string
}): Promise<{ sent: number; failed: string[] }> {
  const db = getDb()
  const failed: string[] = []
  let sent = 0

  for (const email of params.emails) {
    const token = await getInviteToken(params.eventId, email)
    if (!token) continue

    const inviteLink = `${params.baseUrl}/invite/${token}`

    try {
      const timeStr = params.isAllDay
        ? `${params.startDate} (All day)`
        : `${params.startDate} – ${params.endDate}`

      await sendEmail({
        to: email,
        subject: `Invitation: ${params.eventTitle}`,
        html: await buildInvitationEmail({
          title: params.eventTitle,
          timeRange: timeStr,
          inviterName: params.inviterName,
          inviteLink,
          description: params.description,
          location: params.location,
        }),
      })
      sent++
      await db
        .update(eventInvites)
        .set({ emailSent: true, updatedAt: new Date() })
        .where(
          and(
            eq(eventInvites.eventId, params.eventId),
            eq(eventInvites.email, email.toLowerCase().trim()),
          ),
        )
    } catch {
      failed.push(email)
    }
  }

  return { sent, failed }
}

export async function getInviteToken(
  eventId: string,
  email: string,
): Promise<string | null> {
  const db = getDb()
  const [invite] = await db
    .select()
    .from(eventInvites)
    .where(
      and(
        eq(eventInvites.eventId, eventId),
        eq(eventInvites.email, email.toLowerCase().trim()),
      ),
    )
  return invite?.inviteToken ?? null
}

/**
 * All grants sharing a token, oldest first, with LINK semantics: an expired
 * token resolves to nothing. This is the lookup for the anonymous invite-link
 * endpoints, where the token is the only credential — see
 * ADR-0013 (the invite link expires; the grant does not).
 *
 * A series split copies a grant to the new master keeping the token (ADR-0009),
 * so one token can address several masters — the segments of what the
 * participant experiences as a single series. Callers that need the whole
 * picture (the invite page) use this; callers acting on one grant use
 * `getInviteByToken`, which returns the earliest.
 */
export async function getInvitesByToken(token: string) {
  const now = new Date()
  return (await getGrantsByToken(token)).filter(
    (r) => !r.expiresAt || r.expiresAt > now,
  )
}

/**
 * All grants sharing a token, oldest first, with GRANT semantics: expiry is
 * ignored. Only for callers that have already authenticated the participant
 * some other way (a session, or MCP's email check) — the grant outlives the
 * emailed link (ADR-0013), so those callers must not be locked out with it.
 */
export async function getGrantsByToken(token: string) {
  const db = getDb()
  const rows = await db
    .select()
    .from(eventInvites)
    .where(eq(eventInvites.inviteToken, token))
  return rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

export async function getInviteByToken(token: string) {
  const [invite] = await getInvitesByToken(token)
  return invite ?? null
}

/**
 * The invite row's own RSVP, which answers only for a NON-recurring event. A
 * recurring event's answers live per occurrence in `event_invite_occurrences`
 * (see `updateOccurrenceRsvp`) because they must stay independent.
 */
export async function updateRsvp(
  token: string,
  status: 'pending' | 'accepted' | 'maybe' | 'declined',
) {
  const db = getDb()
  await db
    .update(eventInvites)
    .set({ status, updatedAt: new Date() })
    .where(eq(eventInvites.inviteToken, token))
}

/**
 * Applies to every segment sharing the token, deliberately: "added to my
 * calendar" is one decision about one shared event, and a split is invisible to
 * the participant who made it.
 */
export async function addParticipantToCalendar(
  token: string,
  categoryId: string | null,
) {
  const db = getDb()
  await db
    .update(eventInvites)
    .set({ addedToCalendar: true, categoryId, updatedAt: new Date() })
    .where(eq(eventInvites.inviteToken, token))
}

export async function removeParticipantFromCalendar(token: string) {
  const db = getDb()
  await db
    .update(eventInvites)
    .set({
      addedToCalendar: false,
      categoryId: null,
      updatedAt: new Date(),
    })
    .where(eq(eventInvites.inviteToken, token))
}

export async function deleteInvitesForEvent(eventId: string) {
  const db = getDb()
  await db.delete(eventInvites).where(eq(eventInvites.eventId, eventId))
}

export async function deleteInviteByToken(token: string) {
  const db = getDb()
  await db.delete(eventInvites).where(eq(eventInvites.inviteToken, token))
}

export async function getInvitesForEvent(eventId: string) {
  const db = getDb()
  return db.select().from(eventInvites).where(eq(eventInvites.eventId, eventId))
}

// --- Per-occurrence visibility ---

/** Reads an invite row's baseline into the shape the visibility rules take. */
export function baselineOf(row: {
  baselineKind: string
  fromStamp: string | null
  untilStamp: string | null
}): InviteVisibility {
  return {
    baselineKind: (row.baselineKind === 'none'
      ? 'none'
      : 'all') as BaselineKind,
    fromStamp: row.fromStamp,
    untilStamp: row.untilStamp,
  }
}

export async function getInviteOccurrences(
  inviteId: string,
): Promise<OccurrenceException[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(eventInviteOccurrences)
    .where(eq(eventInviteOccurrences.inviteId, inviteId))
  return rows.map((r) => ({
    recurrenceId: r.recurrenceId,
    visible: r.visible,
    status: r.status as RsvpStatus,
  }))
}

/** Exceptions for many invites at once, keyed by invite id. */
export async function getOccurrencesForInvites(
  inviteIds: string[],
): Promise<Map<string, OccurrenceException[]>> {
  const byInvite = new Map<string, OccurrenceException[]>()
  if (inviteIds.length === 0) return byInvite

  const db = getDb()
  const rows = await db
    .select()
    .from(eventInviteOccurrences)
    .where(inArray(eventInviteOccurrences.inviteId, inviteIds))

  for (const row of rows) {
    const list = byInvite.get(row.inviteId) ?? []
    list.push({
      recurrenceId: row.recurrenceId,
      visible: row.visible,
      status: row.status as RsvpStatus,
    })
    byInvite.set(row.inviteId, list)
  }
  return byInvite
}

/**
 * Applies a plan from `planParticipantChange`. The plan decides; this only
 * writes, so the rules stay in one testable place.
 */
export async function applyParticipantChangePlan(params: {
  inviteId: string
  plan: ParticipantChangePlan
}) {
  const { inviteId, plan } = params
  const db = getDb()

  if (plan.baseline) {
    await db
      .update(eventInvites)
      .set({
        baselineKind: plan.baseline.baselineKind,
        fromStamp: plan.baseline.fromStamp,
        untilStamp: plan.baseline.untilStamp,
        updatedAt: new Date(),
      })
      .where(eq(eventInvites.id, inviteId))
  }

  if (plan.deleteExceptionStamps.length > 0) {
    await db
      .delete(eventInviteOccurrences)
      .where(
        and(
          eq(eventInviteOccurrences.inviteId, inviteId),
          inArray(
            eventInviteOccurrences.recurrenceId,
            plan.deleteExceptionStamps,
          ),
        ),
      )
  }

  for (const exception of plan.upsertExceptions) {
    await db
      .insert(eventInviteOccurrences)
      .values({
        id: crypto.randomUUID(),
        inviteId,
        recurrenceId: exception.recurrenceId,
        visible: exception.visible,
        status: exception.status ?? 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          eventInviteOccurrences.inviteId,
          eventInviteOccurrences.recurrenceId,
        ],
        // Deliberately does NOT reset `status`: flipping an occurrence's
        // visibility must not silently discard a participant's RSVP.
        set: { visible: exception.visible, updatedAt: new Date() },
      })
  }
}

/**
 * Records an RSVP against one occurrence. Creates the exception row when the
 * occurrence is visible only through the baseline, so a per-occurrence answer
 * always has somewhere to live.
 */
export async function updateOccurrenceRsvp(params: {
  inviteId: string
  recurrenceId: string
  status: RsvpStatus
  visible: boolean
}) {
  const db = getDb()
  await db
    .insert(eventInviteOccurrences)
    .values({
      id: crypto.randomUUID(),
      inviteId: params.inviteId,
      recurrenceId: params.recurrenceId,
      visible: params.visible,
      status: params.status,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        eventInviteOccurrences.inviteId,
        eventInviteOccurrences.recurrenceId,
      ],
      set: { status: params.status, updatedAt: new Date() },
    })
}

export async function resendInviteEmail(params: {
  eventId: string
  eventTitle: string
  startDate: string
  endDate: string
  isAllDay: boolean
  inviterName: string
  description?: string
  location?: string
  email: string
  baseUrl: string
}): Promise<boolean> {
  const db = getDb()
  const token = await getInviteToken(params.eventId, params.email)
  if (!token) return false

  const inviteLink = `${params.baseUrl}/invite/${token}`

  try {
    const timeStr = params.isAllDay
      ? `${params.startDate} (All day)`
      : `${params.startDate} – ${params.endDate}`

    await sendEmail({
      to: params.email,
      subject: `Invitation: ${params.eventTitle}`,
      html: await buildInvitationEmail({
        title: params.eventTitle,
        timeRange: timeStr,
        inviterName: params.inviterName,
        inviteLink,
        description: params.description,
        location: params.location,
      }),
    })
    await db
      .update(eventInvites)
      .set({
        emailSent: true,
        // A resend mints a fresh link window. Without this the recovery path
        // for an expired link re-sent the same dead token (ADR-0013).
        expiresAt: new Date(Date.now() + INVITE_LINK_TTL_MS),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(eventInvites.eventId, params.eventId),
          eq(eventInvites.email, params.email.toLowerCase().trim()),
        ),
      )
    return true
  } catch {
    return false
  }
}
