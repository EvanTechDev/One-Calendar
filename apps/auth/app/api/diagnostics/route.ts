import { NextResponse } from 'next/server'
import { buildPortalDiagnostics } from '@zntr/auth/diagnostics'

/**
 * Whether this deployment is configured correctly.
 *
 * A misconfiguration here presents as a mysteriously anonymous user with nothing
 * in any log — the exact failure the shared-cookie arrangement produced twice.
 * This is how that becomes visible instead.
 *
 * Reports presence, never values (see @zntr/auth/diagnostics). Unauthenticated
 * on purpose: it has to work when authentication is the thing that is broken,
 * and it discloses nothing an attacker could not learn by making a request.
 */
export async function GET() {
  const report = buildPortalDiagnostics({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.NEXT_PUBLIC_BASE_URL,
    clientOrigins: (process.env.AUTH_CLIENT_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    databaseUrl: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    sentinelApiKey: process.env.BETTER_AUTH_API_KEY,
    isProduction: process.env.NODE_ENV === 'production',
  })

  return NextResponse.json(report, {
    // Never cached: the whole value is telling you the state right now.
    headers: { 'Cache-Control': 'no-store' },
  })
}
