import { renderAuthEmailTemplate } from '@/lib/auth/email-template'
import { sendAuthEmail } from '@/lib/auth/send-auth-email'

const baseURL = process.env.NEXT_PUBLIC_BASE_URL
const signInUrl = baseURL
  ? `${baseURL}/sign-in`
  : 'http://localhost:3000/sign-in'

export async function sendWelcomeEmail(to: string) {
  await sendAuthEmail({
    to,
    subject: 'Welcome to One Calendar!',
    html: await renderAuthEmailTemplate({
      preview: 'Welcome to One Calendar',
      title: 'Welcome to One Calendar!',
      body: "We're thrilled to have you here. One Calendar helps you stay organized with powerful features designed around your privacy.",
      actionLabel: 'Start using One Calendar',
      actionUrl: signInUrl,
      secondary:
        'Create events, organize with categories, and share securely — all in one place.',
    }),
  })
}
