import { Resend } from 'resend'
import { APP_CONFIG } from '@/lib/config'

/**
 * Scheduled sends, kept separate from `lib/auth/send-auth-email.ts` because
 * these are not auth emails and because they need the provider's message id
 * back — without it nothing can be rescheduled or cancelled.
 *
 * See ADR-0010 (email reminders are opt-in per event and scheduled through Resend).
 */

const resendKey = process.env.RESEND_API_KEY
const resend = resendKey ? new Resend(resendKey) : null

/** The provider accepts a send at most this far ahead. */
export const MAX_SCHEDULE_AHEAD_MS = 30 * 24 * 60 * 60 * 1000

export class EmailProviderUnavailable extends Error {}

function client(): Resend {
  if (!resend) throw new EmailProviderUnavailable('RESEND_API_KEY is not set')
  return resend
}

/** Schedules an email and returns the provider's message id. */
export async function scheduleEmail(payload: {
  to: string
  subject: string
  html: string
  scheduledAt: Date
}): Promise<string> {
  const result = await client().emails.send({
    from: APP_CONFIG.auth.resend.sender,
    to: [payload.to],
    subject: payload.subject,
    html: payload.html,
    scheduledAt: payload.scheduledAt.toISOString(),
  })

  if (result.error) throw new Error(result.error.message)
  if (!result.data?.id) {
    throw new Error('Email provider did not return a message id')
  }
  return result.data.id
}

/**
 * Moves an already-scheduled send. Returns false when the provider refuses —
 * typically because it already sent — so the caller can cancel-and-reschedule
 * rather than leaving a stale row.
 */
export async function rescheduleEmail(
  providerId: string,
  scheduledAt: Date,
): Promise<boolean> {
  try {
    const result = await client().emails.update({
      id: providerId,
      scheduledAt: scheduledAt.toISOString(),
    })
    return !result.error
  } catch {
    return false
  }
}

/**
 * Cancels a scheduled send. Returns false if the provider would not, which for
 * a delete path means the row should still go — an orphaned provider record is
 * better than an event that cannot be deleted.
 */
export async function cancelEmail(providerId: string): Promise<boolean> {
  try {
    const result = await client().emails.cancel(providerId)
    return !result.error
  } catch {
    return false
  }
}
