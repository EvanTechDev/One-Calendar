import { exposedPortalPaths } from './route-policy'

/**
 * A report on whether the portal is configured correctly.
 *
 * It exists because a misconfiguration in this area presents as a mysteriously
 * anonymous user with nothing in any log — the failure mode the shared-cookie
 * arrangement produced twice. Something has to be able to answer "is my
 * configuration right" without a database dump.
 *
 * Which makes it a hazard, so the rule is absolute: it reports **presence**, not
 * values. Not the secret, not its length, not a prefix. `'set'` or `'missing'`
 * is the entire signal a secret contributes, because a length narrows a brute
 * force and a prefix identifies which secret it is.
 *
 * Origins and paths are reported in full: a redirect URI appears in every
 * authorization request and a path is discoverable by asking, so neither is
 * secret — and both are the things most commonly wrong.
 */

export interface PortalDiagnosticsInput {
  secret?: string
  baseURL?: string
  clientOrigins: string[]
  databaseUrl?: string
  sentinelApiKey?: string
  isProduction?: boolean
}

export interface PortalDiagnostics {
  /** Presence only. Never the value, its length, or a prefix. */
  secret: 'set' | 'missing'
  /** Safe to report: it is the OAuth issuer, published in discovery metadata. */
  baseURL: string | 'missing'
  database: 'set' | 'missing'
  sentinel: 'set' | 'missing'
  /** Public by nature — every authorization request carries one. */
  clientOrigins: string[]
  exposedPaths: string[]
  warnings: string[]
}

/** Whether a host is a loopback address, where plain http is legitimate. */
function isLoopback(origin: string): boolean {
  try {
    const { hostname } = new URL(origin)
    return (
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
    )
  } catch {
    return false
  }
}

export function buildPortalDiagnostics(
  input: PortalDiagnosticsInput,
): PortalDiagnostics {
  const warnings: string[] = []

  if (input.clientOrigins.length === 0) {
    // Every authorization request fails the CSRF check without one, and every
    // client looks broken for no visible reason.
    warnings.push('no client origins configured')
  }

  for (const origin of input.clientOrigins) {
    if (origin.startsWith('http://') && !isLoopback(origin)) {
      // Plain http on a routable host means an authorization code travels in
      // clear text. Only warned in production, because a warning that always
      // fires is a warning nobody reads.
      if (input.isProduction) {
        warnings.push(`client origin is not https: ${origin}`)
      }
    }
  }

  if (!input.secret) {
    warnings.push(
      'BETTER_AUTH_SECRET is not set; the portal cannot sign tokens',
    )
  }
  if (!input.baseURL) {
    warnings.push('NEXT_PUBLIC_BASE_URL is not set; it is the OAuth issuer')
  }
  if (!input.databaseUrl) {
    warnings.push('POSTGRES_URL is not set')
  }

  return {
    secret: input.secret ? 'set' : 'missing',
    baseURL: input.baseURL ?? 'missing',
    database: input.databaseUrl ? 'set' : 'missing',
    sentinel: input.sentinelApiKey ? 'set' : 'missing',
    clientOrigins: [...input.clientOrigins],
    exposedPaths: exposedPortalPaths(),
    warnings,
  }
}
