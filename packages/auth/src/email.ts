/**
 * The auth emails, shared by every app that can sign a user up.
 *
 * These callbacks lived in the calendar's auth config with "Zentra Calendar"
 * written into the preview text. Meet's instance declared the same callbacks as
 * inert stubs — `sendResetPassword: async () => {}` — which means a registration
 * there would have succeeded while the verification mail was silently dropped.
 *
 * Sharing them is what makes a second sign-up surface safe (ADR 0022): an app
 * cannot mount the sign-up form without also getting working mail, because both
 * come from here.
 */

import { Resend } from 'resend'
import { renderAuthEmailTemplate } from './email-template'
import type { EmailBrand } from './email-brand'

export type EmailMessage = {
  to: string
  from: string
  subject: string
  html: string
}

export type EmailSender = (message: EmailMessage) => Promise<void>

/**
 * A Resend-backed sender.
 *
 * Throws rather than resolving when the key is absent. A silent no-op here means
 * sign-up appears to work and the verification mail never arrives, which is the
 * exact failure meet's inert callbacks had.
 */
export function resendSender(): EmailSender {
  const key = process.env.RESEND_API_KEY
  const resend = key ? new Resend(key) : null

  return async (message) => {
    if (!resend) throw new Error('RESEND_API_KEY is not configured')

    const result = await resend.emails.send({
      from: message.from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
    })

    if (result.error) throw new Error(result.error.message)
    // A send with no message id did not queue anything, whatever the absence of
    // an error suggests.
    if (!result.data?.id) {
      throw new Error('Email provider did not return a message id')
    }
  }
}

type MinimalUser = { email?: string | null }

export type AuthEmailCallbacks = {
  sendResetPassword: (args: { user: MinimalUser; url: string }) => Promise<void>
  sendVerificationEmail: (args: {
    user: MinimalUser
    url: string
  }) => Promise<void>
  sendChangeEmailVerification: (args: {
    user: MinimalUser
    newEmail: string
    url: string
  }) => Promise<void>
  sendVerificationOTP: (args: {
    email: string
    otp: string
    type: string
  }) => Promise<void>
}

export function authEmailCallbacks(options: {
  brand: EmailBrand
  send: EmailSender
}): AuthEmailCallbacks {
  const { brand, send } = options

  // Better Auth types `user.email` as optional. Resend rejects a blank recipient
  // with an opaque error, so this fails where the cause is still visible.
  const recipient = (email: string | null | undefined): string => {
    const to = email?.trim()
    if (!to) throw new Error('Cannot send auth email: no recipient address')
    return to
  }

  const deliver = async (args: {
    to: string
    subject: string
    preview: string
    title: string
    body: string
    actionLabel?: string
    actionUrl?: string
    code?: string
    secondary?: string
  }) => {
    const { to, subject, ...template } = args
    await send({
      to,
      from: brand.sender,
      subject,
      html: await renderAuthEmailTemplate({ brand, ...template }),
    })
  }

  return {
    sendResetPassword: async ({ user, url }) =>
      deliver({
        to: recipient(user.email),
        subject: 'Reset your password',
        preview: `Reset your ${brand.appName} password`,
        title: 'Reset your password',
        body: 'We received a request to reset your password. Use the button below to continue.',
        actionLabel: 'Reset password',
        actionUrl: url,
        secondary:
          'If you did not request this, you can safely ignore this email.',
      }),

    sendVerificationEmail: async ({ user, url }) =>
      deliver({
        to: recipient(user.email),
        subject: 'Verify your email',
        preview: `Verify your ${brand.appName} email`,
        title: 'Verify your email',
        body: 'Confirm your email address to finish setting up your account.',
        actionLabel: 'Verify email',
        actionUrl: url,
      }),

    // To the NEW address, deliberately. Sending it to the current one proves
    // nothing about the new address, and would let a typo move the account to a
    // mailbox nobody reads.
    sendChangeEmailVerification: async ({ user, newEmail, url }) =>
      deliver({
        to: recipient(newEmail),
        subject: 'Confirm your new email',
        preview: `Confirm your ${brand.appName} email change`,
        title: 'Confirm your new email',
        body: `A request was made to change your account email from ${user.email} to ${newEmail}.`,
        actionLabel: 'Confirm email change',
        actionUrl: url,
        secondary: 'If this was not you, you can ignore this email.',
      }),

    sendVerificationOTP: async ({ email, otp, type }) => {
      const isRecovery = type === 'forget-password'
      await deliver({
        to: recipient(email),
        // Distinguished in the subject: a user who asked for neither should be
        // able to tell which one arrived without opening it.
        subject: isRecovery ? 'Reset code' : 'Verification code',
        // The code is deliberately absent from the preview. Preview text renders
        // on a lock screen, and a code visible there defeats the point of
        // sending it to a mailbox the user has to open.
        preview: isRecovery
          ? `Your ${brand.appName} reset code`
          : `Your ${brand.appName} verification code`,
        title: isRecovery ? 'Reset code' : 'Verification code',
        body: isRecovery
          ? 'Use the code below to reset your password.'
          : `Use the code below to continue with your ${brand.appName} account.`,
        code: otp,
        secondary: 'This code will expire shortly for your security.',
      })
    },
  }
}
