import { NextResponse } from 'next/server'
import { CALENDAR_EMAIL_BRAND } from '@/lib/auth/brand'
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
      subject: 'Welcome to Zentra Calendar!',
      html: await renderAuthEmailTemplate({
    brand: CALENDAR_EMAIL_BRAND,
        preview: 'Welcome to Zentra Calendar',
        title: 'Welcome to Zentra Calendar!',
        body: "We're thrilled to have you here. Zentra Calendar is the next gen calendar powered by AI agent: plan your week in conversation and stay organized.",
        actionLabel: 'Start using Zentra Calendar',
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
