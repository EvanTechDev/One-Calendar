import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from '@/lib/auth/server'

export const runtime = 'nodejs'

/**
 * Why the dashboard is or is not showing.
 *
 * Cross-app session sharing has four independent failure modes (cookie domain,
 * secret mismatch, database reachability, registered-domain mismatch) and every
 * one of them presents identically: a signed-in user sees the guest page. This
 * endpoint names the actual cause instead.
 *
 * Reports only presence and shape — never a secret's value. Safe to leave
 * enabled: everything here is already inferable by any visitor except the
 * config-mismatch reasoning, which is the point.
 */
export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie') ?? ''
  const cookieNames = cookieHeader
    .split(';')
    .map((part) => part.split('=')[0]?.trim())
    .filter((name): name is string => Boolean(name))

  // Better Auth's session cookie, with or without the __Secure- prefix it
  // adds over https.
  const sessionCookie = cookieNames.find((name) =>
    name.replace(/^__Secure-/, '').startsWith('better-auth.session_token'),
  )

  const requestHost = request.headers.get('host') ?? ''
  const cookieDomain = process.env.AUTH_COOKIE_DOMAIN ?? null
  const calendarOrigin = process.env.NEXT_PUBLIC_CALENDAR_ORIGIN ?? null
  const selfOrigin = process.env.NEXT_PUBLIC_BASE_URL ?? null

  // A cookie's Domain must be a parent of the host that set it, so both apps
  // have to sit under one registered domain. Compare the last two labels.
  const registrableOf = (value: string | null): string | null => {
    if (!value) return null
    try {
      const host = value.includes('://')
        ? new URL(value).hostname
        : value.split(':')[0]!
      const labels = host.split('.')
      return labels.slice(-2).join('.')
    } catch {
      return null
    }
  }

  const selfRegistrable = registrableOf(selfOrigin ?? requestHost)
  const calendarRegistrable = registrableOf(calendarOrigin)
  const domainsCompatible =
    selfRegistrable !== null &&
    calendarRegistrable !== null &&
    selfRegistrable === calendarRegistrable

  let session: Awaited<ReturnType<typeof getServerSession>> = null
  let sessionError: string | null = null
  try {
    session = await getServerSession()
  } catch (error) {
    sessionError = error instanceof Error ? error.message : 'unknown'
  }

  // Prove the shared database is reachable and holds the meeting tables,
  // without leaking any row contents.
  let databaseReachable = false
  let databaseError: string | null = null
  try {
    const { getDb } = await import('@/lib/drizzle')
    const { meeting } = await import('@zntr/meetings')
    const { sql } = await import('drizzle-orm')
    await getDb()
      .select({ ok: sql<number>`1` })
      .from(meeting)
      .limit(1)
    databaseReachable = true
  } catch (error) {
    databaseError = error instanceof Error ? error.message : 'unknown'
  }

  const problems: string[] = []

  if (!process.env.BETTER_AUTH_SECRET) {
    problems.push('BETTER_AUTH_SECRET is not set in this deployment.')
  }
  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
    problems.push('Neither POSTGRES_URL nor DATABASE_URL is set.')
  }
  if (!databaseReachable) {
    problems.push(
      `The shared database is unreachable or the meeting tables are missing: ${databaseError}. Session reads fail silently when this happens, so every visitor looks like a guest.`,
    )
  }
  if (!calendarOrigin) {
    problems.push(
      'NEXT_PUBLIC_CALENDAR_ORIGIN is not set. NEXT_PUBLIC_* values are inlined at BUILD time — setting it in the dashboard without redeploying leaves it undefined here.',
    )
  }
  if (!selfOrigin) {
    problems.push(
      'NEXT_PUBLIC_BASE_URL is not set, so the sign-in link cannot ask the calendar to send the user back.',
    )
  }
  if (!cookieDomain) {
    problems.push(
      'AUTH_COOKIE_DOMAIN is not set. Without it Better Auth issues host-only cookies, so a session created on the calendar is never sent here.',
    )
  } else if (!cookieDomain.startsWith('.')) {
    problems.push(
      `AUTH_COOKIE_DOMAIN is "${cookieDomain}" — it must start with a dot (e.g. ".xyehr.cn") to cover subdomains.`,
    )
  } else if (selfRegistrable && !`${cookieDomain}`.endsWith(selfRegistrable)) {
    problems.push(
      `AUTH_COOKIE_DOMAIN "${cookieDomain}" is not a parent of this host (${requestHost}). A cookie's Domain may only be a parent of the host that sets it.`,
    )
  }
  if (calendarOrigin && !domainsCompatible) {
    problems.push(
      `This app (${selfRegistrable}) and the calendar (${calendarRegistrable}) are different registered domains, so a shared cookie is impossible regardless of configuration.`,
    )
  }
  if (!sessionCookie) {
    problems.push(
      'The browser sent no Better Auth session cookie with this request. Either you are not signed in on the calendar, or the cookie is host-only (see AUTH_COOKIE_DOMAIN) and therefore not sent to this host.',
    )
  } else if (!session) {
    problems.push(
      `A session cookie WAS sent (${sessionCookie}) but no session resolved${sessionError ? `: ${sessionError}` : ''}. The usual cause is BETTER_AUTH_SECRET differing between the two apps — the cookie is signed with it, so a mismatch fails verification with no error.`,
    )
  }
  if (!process.env.SALT) {
    problems.push(
      'SALT is not set, so calendar event titles cannot be decrypted and every linked meeting will read "Untitled meeting".',
    )
  }
  if (!process.env.LIVEKIT_URL || !process.env.LIVEKIT_API_KEY) {
    problems.push('LiveKit is not configured; no meeting can be joined.')
  }

  return NextResponse.json({
    dashboardVisible: Boolean(session),
    signedInAs: session?.user.email ?? null,
    request: {
      host: requestHost,
      sessionCookiePresent: Boolean(sessionCookie),
      sessionCookieName: sessionCookie ?? null,
      cookiesSeen: cookieNames.length,
    },
    config: {
      NEXT_PUBLIC_BASE_URL: selfOrigin,
      NEXT_PUBLIC_CALENDAR_ORIGIN: calendarOrigin,
      AUTH_COOKIE_DOMAIN: cookieDomain,
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? null,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ? 'set' : 'MISSING',
      SALT: process.env.SALT ? 'set' : 'MISSING',
      POSTGRES_URL:
        process.env.POSTGRES_URL || process.env.DATABASE_URL
          ? 'set'
          : 'MISSING',
      LIVEKIT_URL: process.env.LIVEKIT_URL ?? null,
      REDIS_URL: process.env.REDIS_URL ? 'set' : 'unset (rate limits open)',
      CRON_SECRET: process.env.CRON_SECRET ? 'set' : 'MISSING',
    },
    checks: {
      databaseReachable,
      registrableDomainsMatch: domainsCompatible,
      selfRegistrableDomain: selfRegistrable,
      calendarRegistrableDomain: calendarRegistrable,
    },
    problems,
  })
}
