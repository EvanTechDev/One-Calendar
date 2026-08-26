// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { SignJWT, exportJWK, generateKeyPair } from 'jose'
import { verifyPortalToken } from '../../packages/auth/src/verify-token'

/**
 * Plan 026 Seam 3: how a client app decides who is signed in.
 *
 * One function replaces both apps' `getServerSession`, which today disagree —
 * meet swallows errors and the calendar does not. "Is this session valid" should
 * have one answer in one place.
 *
 * Every rejection returns `null` rather than throwing. That is a deliberate
 * product decision, not laziness: a calendar that 500s during an auth incident
 * is worse than one that shows a signed-out view, because a signed-out calendar
 * still renders. The tests below pin it, since an exception escaping here would
 * take down every page at once.
 *
 * A real JWT is signed for each case. Mocking the verifier would test the mock.
 */
const ISSUER = 'https://auth.example.com'
const AUDIENCE = 'https://cal.example.com'

let privateKey: CryptoKey
let jwks: { keys: unknown[] }
let otherPrivateKey: CryptoKey

async function sign(
  claims: Record<string, unknown>,
  options: { key?: CryptoKey; expiresIn?: string } = {},
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuedAt()
    .setIssuer(claims.iss === undefined ? ISSUER : (claims.iss as string))
    .setAudience(claims.aud === undefined ? AUDIENCE : (claims.aud as string))
    .setExpirationTime(options.expiresIn ?? '10m')
    .sign(options.key ?? privateKey)
}

/** A JWKS resolver over the in-memory key set, standing in for the portal. */
function resolver(set: { keys: unknown[] } = jwks) {
  return async () => set
}

beforeAll(async () => {
  const pair = await generateKeyPair('ES256')
  privateKey = pair.privateKey
  const publicJwk = await exportJWK(pair.publicKey)
  publicJwk.kid = 'portal-key-1'
  publicJwk.alg = 'ES256'
  jwks = { keys: [publicJwk] }

  const other = await generateKeyPair('ES256')
  otherPrivateKey = other.privateKey
})

describe('verifyPortalToken', () => {
  it('accepts a token the portal signed', async () => {
    const token = await sign({ sub: 'user-1', email: 'a@example.com' })
    const session = await verifyPortalToken(token, {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwks: resolver(),
    })
    expect(session?.userId).toBe('user-1')
  })

  it('returns null for a token signed by another key', async () => {
    // The whole point of verifying against the portal's JWKS: anyone can mint a
    // well-formed JWT, and only the portal's signature makes one authoritative.
    const token = await sign({ sub: 'user-1' }, { key: otherPrivateKey })
    const session = await verifyPortalToken(token, {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwks: resolver(),
    })
    expect(session).toBeNull()
  })

  it('returns null for an expired token', async () => {
    // A JWT cannot be revoked individually, so expiry is the control. Honouring
    // it is not optional.
    const token = await sign({ sub: 'user-1' }, { expiresIn: '-1m' })
    const session = await verifyPortalToken(token, {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwks: resolver(),
    })
    expect(session).toBeNull()
  })

  it('returns null for the wrong audience', async () => {
    // A token minted for meet must not authenticate a calendar request.
    // Otherwise a compromise of one app's token store is a compromise of both.
    const token = await sign({ sub: 'user-1', aud: 'https://meet.example.com' })
    const session = await verifyPortalToken(token, {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwks: resolver(),
    })
    expect(session).toBeNull()
  })

  it('returns null for the wrong issuer', async () => {
    // Guards against a second authorization server -- a staging portal, or an
    // attacker's -- being accepted by production.
    const token = await sign({ sub: 'user-1', iss: 'https://evil.example.com' })
    const session = await verifyPortalToken(token, {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwks: resolver(),
    })
    expect(session).toBeNull()
  })

  it('returns null for a token with no subject', async () => {
    // Without `sub` there is no user, and a session object with an undefined
    // user id is worse than none: downstream code would treat it as signed in.
    const token = await sign({ email: 'a@example.com' })
    const session = await verifyPortalToken(token, {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwks: resolver(),
    })
    expect(session).toBeNull()
  })

  it('returns null for a malformed token rather than throwing', async () => {
    for (const value of ['', 'not-a-jwt', 'a.b.c', 'a.b']) {
      const session = await verifyPortalToken(value, {
        issuer: ISSUER,
        audience: AUDIENCE,
        jwks: resolver(),
      })
      expect(session, value).toBeNull()
    }
  })

  it('returns null when the portal is unreachable', async () => {
    // The behaviour that decides whether an auth outage takes both apps down.
    // Signed-out is recoverable; a 500 on every page is not.
    const session = await verifyPortalToken(await sign({ sub: 'user-1' }), {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwks: async () => {
        throw new Error('portal unreachable')
      },
    })
    expect(session).toBeNull()
  })

  it('returns null when the JWKS holds no usable key', async () => {
    const session = await verifyPortalToken(await sign({ sub: 'user-1' }), {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwks: resolver({ keys: [] }),
    })
    expect(session).toBeNull()
  })

  it('refuses an unsigned token', async () => {
    // `alg: none` is the classic JWT attack: a token with no signature that a
    // naive verifier accepts because the header told it to.
    const unsigned =
      Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
        'base64url',
      ) +
      '.' +
      Buffer.from(
        JSON.stringify({ sub: 'user-1', iss: ISSUER, aud: AUDIENCE }),
      ).toString('base64url') +
      '.'

    const session = await verifyPortalToken(unsigned, {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwks: resolver(),
    })
    expect(session).toBeNull()
  })

  it('carries through the profile claims a client displays', async () => {
    // An app shows a name and avatar; it must not have to call UserInfo for
    // something already in the token it holds.
    const token = await sign({
      sub: 'user-1',
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      picture: 'https://cdn.example.com/ada.png',
    })
    const session = await verifyPortalToken(token, {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwks: resolver(),
    })
    expect(session).toEqual({
      userId: 'user-1',
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      image: 'https://cdn.example.com/ada.png',
      expiresAt: expect.any(Date),
    })
  })
})
