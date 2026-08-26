// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authEmailCallbacks } from '@zntr/auth/email'
import { authEmailBrand } from '@zntr/auth/email-brand'

/**
 * The auth email callbacks.
 *
 * Every one of these lived in the calendar's auth config with "Zentra Calendar"
 * written into the preview text. Meet's instance had the same callbacks as inert
 * stubs (`sendResetPassword: async () => {}`), so a registration there would have
 * succeeded while the verification mail was silently dropped (ADR 0022).
 */
const brand = authEmailBrand({
  appName: 'Zentra Meet',
  tagline: 'Meetings that respect your privacy.',
  baseUrl: 'https://meettest.xyehr.cn',
})

let sent: Array<{ to: string; subject: string; html: string; from: string }>

const send = vi.fn(async (m: (typeof sent)[number]) => {
  sent.push(m)
})

beforeEach(() => {
  sent = []
  send.mockClear()
})

const callbacks = () => authEmailCallbacks({ brand, send })

describe('authEmailCallbacks', () => {
  it('signs mail with the calling app, not the calendar', async () => {
    await callbacks().sendVerificationEmail({
      user: { email: 'a@example.com' },
      url: 'https://meettest.xyehr.cn/verify?t=1',
    })
    expect(sent).toHaveLength(1)
    expect(sent[0].from).toContain('Zentra Meet')
    expect(sent[0].html).toContain('Zentra Meet')
    expect(sent[0].html).not.toContain('Zentra Calendar')
  })

  it('sends a password reset to the account address', async () => {
    await callbacks().sendResetPassword({
      user: { email: 'a@example.com' },
      url: 'https://x/reset?t=1',
    })
    expect(sent[0].to).toBe('a@example.com')
    expect(sent[0].html).toContain('https://x/reset?t=1')
  })

  it('sends an email-change confirmation to the NEW address', async () => {
    // Sending it to the current address proves nothing about the new one, and
    // would let a typo lock the account to an address nobody reads.
    await callbacks().sendChangeEmailVerification({
      user: { email: 'old@example.com' },
      newEmail: 'new@example.com',
      url: 'https://x/confirm?t=1',
    })
    expect(sent[0].to).toBe('new@example.com')
    expect(sent[0].html).toContain('old@example.com')
    expect(sent[0].html).toContain('new@example.com')
  })

  it('labels a recovery code differently from a verification code', async () => {
    // Same template, different intent: a user who asked for neither should be
    // able to tell from the subject which one arrived.
    await callbacks().sendVerificationOTP({
      email: 'a@example.com',
      otp: '123456',
      type: 'forget-password',
    })
    await callbacks().sendVerificationOTP({
      email: 'a@example.com',
      otp: '654321',
      type: 'email-verification',
    })
    expect(sent[0].subject).not.toBe(sent[1].subject)
    expect(sent[0].html).toContain('123456')
    expect(sent[1].html).toContain('654321')
  })

  it('never sends to an empty address', async () => {
    // Better Auth types user.email as optional. Resend rejects a blank
    // recipient with an opaque error, so this fails where the cause is visible.
    await expect(
      callbacks().sendVerificationEmail({ user: {}, url: 'https://x' }),
    ).rejects.toThrow(/recipient|email/i)
    expect(send).not.toHaveBeenCalled()
  })

  it('produces html, not a react element', async () => {
    // Better Auth hands the result straight to the transport.
    await callbacks().sendResetPassword({
      user: { email: 'a@example.com' },
      url: 'https://x',
    })
    expect(typeof sent[0].html).toBe('string')
    expect(sent[0].html).toMatch(/<html/i)
  })

  it('omits an OTP from the preview text', async () => {
    // Preview text shows on a lock screen. A code visible there defeats the
    // point of sending it to a mailbox the user has to open.
    await callbacks().sendVerificationOTP({
      email: 'a@example.com',
      otp: '999111',
      type: 'email-verification',
    })
    const preview = sent[0].html.slice(0, sent[0].html.indexOf('</head>'))
    expect(preview).not.toContain('999111')
  })
})
