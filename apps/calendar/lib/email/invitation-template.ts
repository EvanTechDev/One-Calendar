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
  const bodyParts = [`${params.inviterName} invited you to this event.`]
  if (params.location) {
    bodyParts.push(`Location: ${params.location}`)
  }

  return renderAuthEmailTemplate({
    preview: `Invitation: ${params.title}`,
    title: params.title,
    body: bodyParts.join('\n\n'),
    actionLabel: 'View Invitation',
    actionUrl: params.inviteLink,
    secondary: params.description
      ? `Description: ${params.description}`
      : undefined,
  })
}
