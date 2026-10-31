import { authEmailBrand } from '@zntr/auth/email-brand'

/**
 * This app's identity on outgoing mail.
 *
 * A user who registers at meet gets mail signed by meet. The template's branding
 * became a parameter precisely so this app would not send mail claiming to be the
 * calendar (ADR 0022).
 */
export const MEET_EMAIL_BRAND = authEmailBrand({
  appName: 'Zentra Meet',
  tagline: 'Video meetings that keep your conversations yours.',
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL,
  sender: process.env.RESEND_SENDER_EMAIL,
})
