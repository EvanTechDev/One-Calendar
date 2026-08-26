import { NextResponse } from 'next/server'
import { toNextJsHandler } from '@zntr/auth'
import { portalPathIsExposed } from '@zntr/auth/route-policy'
import type { NextRequest } from 'next/server'
import { getPortal } from '@/lib/auth'

/**
 * The portal's auth surface, filtered by an allowlist.
 *
 * The OAuth provider registers `/admin/oauth2/*` endpoints that can create a
 * client, set `skip_consent`, and assign a machine-to-machine scope ceiling.
 * Serving those would let anyone who can reach this app register a client that
 * skips consent and then obtain tokens for any user — an account-takeover
 * primitive rather than a misconfiguration. They are called server-side only,
 * from the seeding script.
 *
 * An allowlist and not a denylist, so an endpoint added by a future plugin
 * upgrade arrives unreachable and forces a decision (see
 * @zntr/auth/route-policy for the paths and why matching is exact).
 */

/** 404 rather than 403: do not confirm which endpoints exist. */
function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

/**
 * The path Better Auth will dispatch on — everything after `/api/auth`.
 *
 * Taken from the raw pathname rather than from the `[...all]` params, because
 * Next decodes those: a `%2e%2e` segment would arrive already turned into `..`,
 * and the allowlist would then be comparing a different string than the router
 * dispatches on.
 */
function handlerPath(request: NextRequest): string {
  const { pathname } = new URL(request.url)
  const prefix = '/api/auth'
  if (!pathname.startsWith(prefix)) return ''
  return pathname.slice(prefix.length) || '/'
}

export async function GET(request: NextRequest) {
  if (!portalPathIsExposed(handlerPath(request))) return notFound()
  return toNextJsHandler(getPortal().auth).GET(request)
}

export async function POST(request: NextRequest) {
  if (!portalPathIsExposed(handlerPath(request))) return notFound()
  return toNextJsHandler(getPortal().auth).POST(request)
}
