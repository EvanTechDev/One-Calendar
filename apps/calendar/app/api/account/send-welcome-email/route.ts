import { NextResponse } from 'next/server'
import { renderAuthEmailTemplate } from '@/lib/auth/email-template'
import { sendAuthEmail } from '@/lib/auth/send-auth-email'
import { getAuthedUser } from '@/lib/api-helpers'
import { checkFixedWindowLimit, rateLimitedResponse } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const baseURL = process.env.NEXT_PUBLIC_BASE_URL
const signInUrl = baseURL
  ? `${baseURL}/sign-in`
  : 'http://localhost:3000/sign-in'

export async function POST() {
  const currentUser = await getAuthedUser()
  if (!currentUser)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!currentUser.email)
    return NextResponse.json({ error: 'No email' }, { status: 400 })

  const limit = await checkFixedWindowLimit({
    name: 'welcome-email',
    subject: currentUser.id,
    limit: 3,
    windowSeconds: 3600,
  })
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfter)

  try {
    await sendAuthEmail({
      to: currentUser.email,
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
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
