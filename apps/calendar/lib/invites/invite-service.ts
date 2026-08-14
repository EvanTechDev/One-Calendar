import crypto from 'crypto'
import { eq, and } from 'drizzle-orm'
import { getDb } from '@/lib/drizzle/client'
import { eventInvites } from '@/lib/drizzle/schema'
import { sendAuthEmail } from '@/lib/auth/send-auth-email'
import { buildInvitationEmail } from '@/lib/email/invitation-template'

async function sendEmail(payload: {
  to: string
  subject: string
  html: string
}) {
  await sendAuthEmail(payload)
}

export interface ParticipantInput {
  email: string
}

export interface InviteResult {
  email: string
  token: string
  status: 'pending' | 'accepted' | 'maybe' | 'declined'
}

export async function createInvitesForEvent(
  eventId: string,
  participants: ParticipantInput[],
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
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  }))

  await db.insert(eventInvites).values(rows)

  return rows.map((r) => ({
    email: r.email,
    token: r.inviteToken,
    status: r.status,
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

export async function getInviteByToken(token: string) {
  const db = getDb()
  const [invite] = await db
    .select()
    .from(eventInvites)
    .where(eq(eventInvites.inviteToken, token))
  const now = new Date()
  return invite && (!invite.expiresAt || invite.expiresAt > now) ? invite : null
}

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

export async function addParticipantToCalendar(
  token: string,
  categoryId: string,
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
      .set({ emailSent: true, updatedAt: new Date() })
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
