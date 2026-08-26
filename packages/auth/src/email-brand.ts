/**
 * Who an auth email is from.
 *
 * The template hard-coded "Zentra Calendar" in six places plus a
 * calendar-specific tagline. That was correct while the calendar was the only
 * sign-up surface; meet is gaining one, and a user who registers at meet
 * receiving mail signed by a different product is a defect (ADR 0022).
 */

export type EmailBrand = {
  /** Display name, used in the header, footer and sender. */
  appName: string
  /** One line under the footer logo. */
  tagline: string
  /** Origin the email's links and images resolve against, no trailing slash. */
  baseUrl: string
  /** RFC 5322 `Name <address>` used as the From header. */
  sender: string
  /** Absolute URL of the logo. */
  logoUrl: string
}

export type EmailBrandInput = {
  appName: string
  tagline: string
  baseUrl?: string
  sender?: string
  logoUrl?: string
}

/**
 * The address auth mail is sent from when an app does not name one.
 *
 * Kept as a single shared mailbox rather than one per app: it is the domain that
 * carries the sending reputation, and a second unverified address is a
 * deliverability problem, not a branding win. The display name still varies.
 */
const DEFAULT_MAILBOX = process.env.RESEND_SENDER_ADDRESS ?? 'no-reply@xyehr.cn'

export function authEmailBrand(input: EmailBrandInput): EmailBrand {
  const appName = input.appName?.trim()
  if (!appName) {
    // A blank brand renders mail with no sender identity — a phishing signal to
    // the recipient and a deliverability problem for us. Better to fail at
    // startup than to send it.
    throw new Error('authEmailBrand requires a non-empty appName')
  }

  // A relative image src in an email resolves against the mail client rather
  // than the app, so it silently shows nothing; and a trailing slash produces
  // `//icon.svg`, which some clients refuse to load.
  const baseUrl = (
    input.baseUrl?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '')

  return {
    appName,
    tagline: input.tagline,
    baseUrl,
    sender: input.sender?.trim() || `${appName} <${DEFAULT_MAILBOX}>`,
    logoUrl: input.logoUrl?.trim() || `${baseUrl}/icon.svg`,
  }
}
