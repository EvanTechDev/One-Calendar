import { NextResponse } from 'next/server'
import { toNextJsHandler } from '@zntr/auth'
import { authRouteIsExposed, authRoutePath } from '@zntr/auth/route-policy'
import {
  captchaIsGuarded,
  isTurnstileConfigured,
  verifyTurnstile,
} from '@zntr/auth/turnstile'
import type { NextRequest } from 'next/server'
import { getAuth } from '@/lib/auth'
import { checkFixedWindowLimit, clientAddress } from '@/lib/rate-limit'

/**
 * Meet's auth route.
 *
 * This used to expose exactly two endpoints, because meet had no sign-in surface
 * and the calendar's route was the only one carrying CAPTCHA verification. It now
 * mounts the shared forms (ADR 0022), so it needs the same protections rather than
 * the same narrow allowlist:
 *
 * - **CAPTCHA**, from `@zntr/auth/turnstile` — the identical check the calendar
 *   runs, on the identical set of paths.
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

async function captchaRejection(
  request: NextRequest,
  path: string,
): Promise<Response | null> {
  if (!captchaIsGuarded(request.method, `/${path}`)) return null

  if (!isTurnstileConfigured()) {
    // Fails open, matching the client: with no site key the widget never renders,
    // so demanding a token would make sign-in impossible. Logged because it
    // removes a defence — a deployment that lost the variable should be findable
    // from its logs rather than from the abuse it invites.
    console.warn('[auth] TURNSTILE_SECRET_KEY is not set — CAPTCHA skipped', {
      path,
    })
    return null
  }

  // Cloned so the handler can still read the body: a request body is a stream and
  // is consumed once.
  let token = ''
  try {
    const body = (await request.clone().json()) as { turnstileToken?: unknown }
    if (typeof body?.turnstileToken === 'string') token = body.turnstileToken
  } catch {
    // A malformed or absent body simply has no token, handled below.
  }

  if (!token) {
    return NextResponse.json({ error: 'CAPTCHA required' }, { status: 400 })
  }

  try {
    const result = await verifyTurnstile(
      token,
      path === 'sign-up/email' ? 'register' : 'login',
    )
    if (!result.success) {
      return NextResponse.json(
        { error: 'CAPTCHA verification failed' },
        { status: 400 },
      )
    }
  } catch (error) {
    // An outage is not a solved challenge. Failing closed is the right trade on a
    // sign-in surface: otherwise anyone who can make Cloudflare unreachable also
    // turns the CAPTCHA off.
    console.error('[auth] CAPTCHA service unavailable', error)
    return NextResponse.json(
      { error: 'CAPTCHA service unavailable' },
      { status: 503 },
    )
  }

  return null
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

  const rejected = await captchaRejection(request, path)
  if (rejected) return rejected

  return toNextJsHandler(getAuth()).POST(request)
}
