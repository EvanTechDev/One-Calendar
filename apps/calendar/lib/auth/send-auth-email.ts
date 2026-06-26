import { Resend } from 'resend'
import { APP_CONFIG } from '@/lib/config'

const resendKey = process.env.RESEND_API_KEY
const resend = resendKey ? new Resend(resendKey) : null

export async function sendAuthEmail(payload: {
  to: string
  subject: string
  html: string
}) {
  if (!resend) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  const result = await resend.emails.send({
    from: APP_CONFIG.auth.resend.sender,
    to: [payload.to],
    subject: payload.subject,
    html: payload.html,
  })

  if (result.error) throw new Error(result.error.message)
  if (!result.data?.id) {
    throw new Error('Email provider did not return a message id')
  }
}
