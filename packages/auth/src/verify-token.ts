import { createLocalJWKSet, jwtVerify } from 'jose'
import type { JSONWebKeySet } from 'jose'

/**
 * How a client app decides who is signed in (ADR 0021, plan 026 Seam 3).
 *
 * A client app verifies a token against the portal's published JWKS. It holds no
 * shared secret and cannot mint a session — the asymmetry that removes the class
 * of failure where three environment variables had to be byte-identical across
 * apps or a user was silently anonymous in one of them.
 *
 * **Every failure returns `null` rather than throwing.** That is a product
 * decision: a calendar that 500s during an auth incident is worse than one
 * showing a signed-out view, because a signed-out calendar still renders its
 * shell. An exception escaping this function would take down every page at once,
 * so the boundary is here and it is absolute.
 */

/** Only the algorithms the portal signs with, listed explicitly. */
const ACCEPTED_ALGORITHMS = ['ES256', 'RS256', 'EdDSA']

export interface PortalSession {
  userId: string
  email?: string
  name?: string
  image?: string
  expiresAt: Date
}

export interface VerifyPortalTokenOptions {
  /** The portal's issuer. Must match the token's `iss` exactly. */
  issuer: string
  /** This client's own identifier. Must match the token's `aud`. */
  audience: string
  /** Resolves the portal's key set. Usually a cached fetch of `/jwks`. */
  jwks: () => Promise<JSONWebKeySet>
}

export async function verifyPortalToken(
  token: string,
  options: VerifyPortalTokenOptions,
): Promise<PortalSession | null> {
  if (!token) return null

  try {
    const keySet = createLocalJWKSet(await options.jwks())

    const { payload } = await jwtVerify(token, keySet, {
      issuer: options.issuer,
      audience: options.audience,
      // Listed explicitly rather than inferred from the token's own header.
      // Trusting the header is how `alg: none` and algorithm-confusion attacks
      // work: the token would be telling the verifier how to check it.
      algorithms: ACCEPTED_ALGORITHMS,
    })

    // No subject means no user. Returning a session whose user id is undefined
    // would be worse than returning none, because callers treat a non-null
    // session as signed in.
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      return null
    }

    return {
      userId: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      // OIDC calls it `picture`; the rest of this codebase calls it `image`.
      image: typeof payload.picture === 'string' ? payload.picture : undefined,
      // `exp` is verified above, so it is present and numeric by this point.
      expiresAt: new Date((payload.exp ?? 0) * 1000),
    }
  } catch {
    // A bad signature, an expired token, a wrong audience or issuer, a malformed
    // token, and an unreachable portal all land here. They are the same answer
    // to the caller — "not signed in" — and distinguishing them would only give
    // an attacker a probe.
    return null
  }
}
