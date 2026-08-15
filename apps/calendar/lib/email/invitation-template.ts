import { renderAuthEmailTemplate } from '@/lib/auth/email-template'

interface InvitationEmailParams {
  title: string
  timeRange: string
  inviterName: string
  inviteLink: string
  description?: string
  location?: string
}

export async function buildInvitationEmail(
  params: InvitationEmailParams,
): Promise<string> {
  return renderAuthEmailTemplate({
    preview: `Invitation: ${params.title}`,
    title: params.title,
    body: `${params.inviterName} invited you to this event. Let them know if you can make it.`,
    actionLabel: 'View Invitation',
    actionUrl: params.inviteLink,
    secondary: buildDetails(params),
  })
}

function buildDetails(params: InvitationEmailParams): string {
  const details: string[] = []
  details.push(`When: ${params.timeRange}`)
  if (params.location) {
    details.push(`Where: ${params.location}`)
  }
  if (params.description) {
    details.push(`Notes: ${params.description}`)
  }
  return details.join('  ·  ')
}
