import { renderAuthEmailTemplate } from '@/lib/auth/email-template'
import { CALENDAR_EMAIL_BRAND } from '@/lib/auth/brand'

interface ReminderEmailParams {
  title: string
  timeRange: string
  appUrl: string
  description?: string
  location?: string
}

/**
 * The organiser's own reminder. Deliberately carries no invite link — this is
 * not an invitation, and a reminder that granted access would be a leak.
 */
export async function buildReminderEmail(
  params: ReminderEmailParams,
): Promise<string> {
  return renderAuthEmailTemplate({
    brand: CALENDAR_EMAIL_BRAND,
    preview: `Reminder: ${params.title}`,
    title: params.title,
    body: 'This event is coming up.',
    actionLabel: 'Open Calendar',
    actionUrl: params.appUrl,
    secondary: buildDetails(params),
  })
}

function buildDetails(params: ReminderEmailParams): string {
  const details: string[] = [`When: ${params.timeRange}`]
  if (params.location) details.push(`Where: ${params.location}`)
  if (params.description) details.push(`Notes: ${params.description}`)
  return details.join('  ·  ')
}
