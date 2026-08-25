import { renderAuthEmailTemplate } from '@/lib/auth/email-template'

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
  // With a meeting attached, joining is the action the recipient will want
  // most often, so it takes the primary button and the RSVP page steps back.
  const hasMeeting = Boolean(params.meetingUrl)

  return renderAuthEmailTemplate({
    preview: `Invitation: ${params.title}`,
    title: params.title,
    body: `${params.inviterName} invited you to this event. Let them know if you can make it.`,
    actionLabel: hasMeeting ? 'Join with Zentra Meet' : 'View Invitation',
    actionUrl: hasMeeting ? params.meetingUrl : params.inviteLink,
    ...(hasMeeting
      ? {
          secondaryActionLabel: 'View invitation and RSVP',
          secondaryActionUrl: params.inviteLink,
        }
      : {}),
    secondary: buildDetails(params),
  })
}

function buildDetails(params: InvitationEmailParams): string {
  const details: string[] = []
  details.push(`When: ${params.timeRange}`)
  if (params.location) {
    details.push(`Where: ${params.location}`)
  }
  // Spelled out as text too: a plain-text client renders no buttons, and this
  // is the link the recipient may want to copy into a browser or share.
  if (params.meetingUrl) {
    details.push(`Join: ${params.meetingUrl}`)
  }
  if (params.description) {
    details.push(`Notes: ${params.description}`)
  }
  return details.join('  ·  ')
}
