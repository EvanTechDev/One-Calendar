import { renderAuthEmailTemplate } from '@/lib/auth/email-template'
import { CALENDAR_EMAIL_BRAND } from '@/lib/auth/brand'

interface InvitationEmailParams {
  title: string
  timeRange: string
  inviterName: string
  inviteLink: string
  description?: string
  location?: string
  /**
   * The Event Meeting's join link, when the event has one.
   *
   * This is the participant's only durable path into the room: the invite link
   * expires after a week (ADR-0013) while the meeting link does not, and
   * holding the meeting link is itself what admits someone (ADR-0019). An
   * email that omits it leaves the recipient one expiry away from having no
   * way in at all.
   */
  meetingUrl?: string
}

export async function buildInvitationEmail(
  params: InvitationEmailParams,
): Promise<string> {
  const details: Array<{ label: string; value: string; href?: string }> = [
    { label: 'When', value: params.timeRange },
  ]
  if (params.location?.trim()) {
    details.push({ label: 'Where', value: params.location })
  }
  if (params.meetingUrl) {
    details.push({
      label: 'Video call',
      value: 'Join with Zentra Meet',
      href: params.meetingUrl,
    })
  }

  return renderAuthEmailTemplate({
    brand: CALENDAR_EMAIL_BRAND,
    preview: `Invitation: ${params.title}`,
    eyebrow: 'Event invitation',
    title: params.title,
    body: `${params.inviterName} invited you. Let them know if you can make it.`,
    details,
    note: params.description?.trim()
      ? { label: 'About this event', text: params.description }
      : undefined,
    // RSVP is the invitation's primary task. The durable meeting link remains
    // visible (and copyable) alongside the event information above it.
    actionLabel: 'Respond to invitation',
    actionUrl: params.inviteLink,
  })
}
