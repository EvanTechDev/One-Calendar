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
    eyebrow: 'Event reminder',
    body: 'This event is coming up.',
    details: [
      { label: 'When', value: params.timeRange },
      ...(params.location?.trim()
        ? [{ label: 'Where', value: params.location }]
        : []),
    ],
    note: params.description?.trim()
      ? { label: 'About this event', text: params.description }
      : undefined,
    actionLabel: 'Open Calendar',
    actionUrl: params.appUrl,
  })
}
