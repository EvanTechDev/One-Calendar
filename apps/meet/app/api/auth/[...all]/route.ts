import { NextResponse } from 'next/server'
import { toNextJsHandler } from '@zntr/auth'
import { authRouteIsExposed, authRoutePath } from '@zntr/auth/route-policy'
import type { NextRequest } from 'next/server'
import { getAuth } from '@/lib/auth'
import { checkFixedWindowLimit, clientAddress } from '@/lib/rate-limit'

/**
 * Meet's auth route.
 *
 * This used to expose exactly two endpoints, because meet had no sign-in surface
 * and the calendar's route was the only one carrying bot verification. It now
 * mounts the shared forms (ADR 0022), so it needs the same protections rather than
 * the same narrow allowlist:
 *
 * - **BotID**, via the shared Better Auth captcha plugin (`botId: true`) — the
 *   identical check the calendar runs, on the identical set of paths.
 * - **Rate limiting** on the credential and mail-sending endpoints, so this app
 *   is not the cheap way to guess passwords or to send mail on our sending
 *   reputation.
 * - **An allowlist**, still. Better Auth mounts a route per plugin, and a
 *   pass-through means this app acquires a public endpoint whenever a dependency
 *   grows one.
 */

/** 404 rather than 403: do not advertise which routes exist. */
function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

/**
 * Per-path budgets.
 *
 * Credential endpoints are limited per address because that is what an attacker
 * varies; mail-sending endpoints are limited harder, since the cost of exceeding
 * them is paid by our domain reputation rather than by us.
 */
const LIMITS: Record<string, { limit: number; windowSeconds: number }> = {
  'request-password-reset': { limit: 3, windowSeconds: 300 },
  'sign-in/email': { limit: 10, windowSeconds: 60 },
  'sign-up/email': { limit: 5, windowSeconds: 300 },
  'forget-password': { limit: 3, windowSeconds: 300 },
  'email-otp/send-verification-otp': { limit: 3, windowSeconds: 300 },
  'email-otp/request-password-reset': { limit: 3, windowSeconds: 300 },
  'email-otp/request-email-change': { limit: 3, windowSeconds: 300 },
}

async function rateLimited(
  request: NextRequest,
  path: string,
): Promise<Response | null> {
  const budget = LIMITS[path]
  if (!budget) return null

  const result = await checkFixedWindowLimit({
    name: `auth:${path}`,
    subject: clientAddress(request),
    ...budget,
  })
  if (result.allowed) return null

  return NextResponse.json(
    { error: 'Too many requests' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfter) } },
  )
}

export async function GET(request: NextRequest) {
  const path = authRoutePath(request.url)
  if (!authRouteIsExposed('GET', path)) return notFound()
  return toNextJsHandler(getAuth()).GET(request)
}

export async function POST(request: NextRequest) {
  const path = authRoutePath(request.url)
  if (!authRouteIsExposed('POST', path)) return notFound()

  const throttled = await rateLimited(request, path)
  if (throttled) return throttled

  return toNextJsHandler(getAuth()).POST(request)
}
