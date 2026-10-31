import { authEmailBrand } from '@zntr/auth/email-brand'
import { APP_CONFIG } from '@/lib/config'

/**
 * This app's identity on outgoing mail.
 *
 * Declared once and imported by every sender — auth, invitations, reminders —
 * because the template's branding became a parameter when meet gained its own
 * sign-up surface (ADR 0022), and six senders each passing their own literal is
 * how one of them ends up disagreeing.
 */
export const CALENDAR_EMAIL_BRAND = authEmailBrand({
  appName: 'Zentra Calendar',
  tagline: 'A privacy-first calendar that keeps your data yours.',
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL,
  sender: APP_CONFIG.auth.resend.sender,
})
