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
class ScheduledEmailClient extends Resend {
  override fetchRequest<T>(path: string, options: RequestInit = {}) {
    return super.fetchRequest<T>(path, {
      ...options,
      signal: AbortSignal.timeout(15_000),
    })
  }
}
const resend = resendKey ? new ScheduledEmailClient(resendKey) : null

/** The provider accepts a send at most this far ahead. */
export const MAX_SCHEDULE_AHEAD_MS = 30 * 24 * 60 * 60 * 1000

class EmailProviderUnavailable extends Error {}

function client(): Resend {
  if (!resend) throw new EmailProviderUnavailable('RESEND_API_KEY is not set')
  return resend
}

/** Schedules an email and returns the provider's message id. */
export async function scheduleEmail(payload: {
  from?: string
  to: string
  subject: string
  html: string
  scheduledAt: Date
  idempotencyKey: string
}): Promise<string> {
  const result = await client().emails.send(
    {
      from: payload.from ?? APP_CONFIG.auth.resend.sender,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      scheduledAt: payload.scheduledAt.toISOString(),
    },
    { idempotencyKey: payload.idempotencyKey },
  )

  if (result.error) throw new Error(result.error.message)
  if (!result.data?.id) {
    throw new Error('Email provider did not return a message id')
  }
  return result.data.id
}

/**
 * Moves an already-scheduled send. Returns false when the provider refuses —
 * or times out. A false result is ambiguous; the caller retains its receipt
 * rather than guessing that the message was sent or canceled.
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
 * False is an uncertain outcome, not proof of cancellation. Keep the receipt
 * and retry; otherwise deletion would orphan a live provider email.
 */
export async function cancelEmail(providerId: string): Promise<boolean> {
  try {
    const result = await client().emails.cancel(providerId)
    return !result.error
  } catch {
    return false
  }
}

export async function scheduledEmailStatus(
  providerId: string,
): Promise<'pending' | 'sent' | 'canceled' | 'unknown'> {
  try {
    const result = await client().emails.get(providerId)
    if (result.error || !result.data) return 'unknown'
    const status = result.data.last_event
    if (status === 'canceled') return 'canceled'
    if (
      [
        'sent',
        'delivered',
        'opened',
        'clicked',
        'bounced',
        'complained',
        'suppressed',
        'failed',
      ].includes(status)
    )
      return 'sent'
    return 'pending'
  } catch {
    return 'unknown'
  }
}
