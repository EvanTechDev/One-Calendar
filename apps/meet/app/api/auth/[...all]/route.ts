import { NextResponse } from 'next/server'
import { toNextJsHandler } from '@zntr/auth'
import type { NextRequest } from 'next/server'
import { getAuth } from '@/lib/auth'

/**
 * Meet shares the calendar's user database but deliberately exposes only a
 * sliver of Better Auth. The calendar's auth route carries captcha, bot
 * blocking, and audit logging; without this allowlist, pointing
 * credential-stuffing or bot sign-ups at this app would bypass all of it.
 *
 * Meet's own UI never signs in — it reads a session established by the
 * calendar and sends users there to authenticate.
 */
const ALLOWED_GET = new Set(['get-session'])
const ALLOWED_POST = new Set(['sign-out'])

function allowedPath(request: NextRequest, allowed: Set<string>): boolean {
  const segments = new URL(request.url).pathname
    .split('/')
    .filter((segment) => segment.length > 0)
  // ['api', 'auth', ...rest] — compare the exact remainder, never a prefix,
  // so no traversal-style segment can smuggle in a different route.
  const rest = segments.slice(2).join('/')
  return allowed.has(rest)
}

/** 404 rather than 403: do not advertise which routes exist. */
function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function GET(request: NextRequest) {
  if (!allowedPath(request, ALLOWED_GET)) return notFound()
  return toNextJsHandler(getAuth()).GET(request)
}

export async function POST(request: NextRequest) {
  if (!allowedPath(request, ALLOWED_POST)) return notFound()
  return toNextJsHandler(getAuth()).POST(request)
}
