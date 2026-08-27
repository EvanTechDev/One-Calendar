import { NextResponse } from 'next/server'
import { resolveReturnTo } from '@/lib/auth/return-to'
import { meetingUrl } from '@/lib/meetings'
import { getServerSession } from '@/lib/auth/server'

export const runtime = 'nodejs'

/**
 * Whether this deployment is configured to hand off to Zentra Meet.
 *
 * `NEXT_PUBLIC_*` values are inlined at build time, so setting one in the
 * hosting dashboard without redeploying leaves it undefined in the shipped
 * bundle — and the only symptom is a sign-in that lands on /app instead of
 * returning to meet. This shows what the running build actually sees.
 *
 * Reports presence and shape only, never a secret's value.
 */
export async function GET() {
  const isProduction = process.env.NODE_ENV === 'production'
  if (isProduction) {
    const session = await getServerSession().catch(() => null)
    if (!session?.user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
  }

  const meetOrigin = process.env.NEXT_PUBLIC_MEET_ORIGIN ?? null
  const selfOrigin = process.env.NEXT_PUBLIC_BASE_URL ?? null
  const cookieDomain = process.env.AUTH_COOKIE_DOMAIN ?? null

  // The exact decision the sign-in page makes for a return request.
  const sampleReturn = meetOrigin ? `${meetOrigin.replace(/\/$/, '')}/` : ''
  const resolved = resolveReturnTo(sampleReturn)
  const returnHonoured = Boolean(sampleReturn) && resolved === sampleReturn

  const problems: string[] = []

  if (!meetOrigin) {
    problems.push(
      'NEXT_PUBLIC_MEET_ORIGIN is not set in this BUILD. Meeting links become relative paths on this origin, and the sign-in allowlist is empty so every return request falls back to /app. Set it and REDEPLOY — a dashboard change alone does not affect an existing build.',
    )
  } else if (!returnHonoured) {
    problems.push(
      `NEXT_PUBLIC_MEET_ORIGIN is "${meetOrigin}" but a return to "${sampleReturn}" still resolves to "${resolved}". The value is probably not a parseable absolute origin (it needs the scheme, e.g. https://meet.example.com).`,
    )
  }
  if (!cookieDomain) {
    problems.push(
      'AUTH_COOKIE_DOMAIN is not set, so sessions created here are host-only and meet will treat every visitor as a guest.',
    )
  }

  if (isProduction) {
    const checks = {
      meetOriginConfigured: Boolean(meetOrigin),
      baseUrlConfigured: Boolean(selfOrigin),
      cookieDomainConfigured: Boolean(cookieDomain),
      authConfigured: Boolean(process.env.BETTER_AUTH_SECRET),
      encryptionConfigured: Boolean(process.env.SALT),
      signInReturnHonoured: returnHonoured,
    }
    const remediation = [
      ...(!checks.meetOriginConfigured ? ['configure-meet-origin'] : []),
      ...(!checks.baseUrlConfigured ? ['configure-base-url'] : []),
      ...(!checks.cookieDomainConfigured ? ['configure-cookie-domain'] : []),
      ...(!checks.authConfigured ? ['configure-auth'] : []),
      ...(!checks.encryptionConfigured ? ['configure-encryption'] : []),
      ...(!checks.signInReturnHonoured ? ['fix-sign-in-return'] : []),
    ]
    return NextResponse.json({
      ready: Object.values(checks).every(Boolean),
      checks,
      remediation,
    })
  }

  return NextResponse.json({
    config: {
      NEXT_PUBLIC_BASE_URL: selfOrigin,
      NEXT_PUBLIC_MEET_ORIGIN: meetOrigin,
      AUTH_COOKIE_DOMAIN: cookieDomain,
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? null,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ? 'set' : 'MISSING',
      SALT: process.env.SALT ? 'set' : 'MISSING',
    },
    checks: {
      // What a meeting link looks like right now, e.g. on an invite email.
      sampleMeetingUrl: meetingUrl('abcd-1234'),
      signInReturnHonoured: returnHonoured,
      signInWouldRedirectTo: resolved,
    },
    problems,
  })
}
