import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { and, eq, like } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/drizzle/client'
import {
  account,
  oauthClient,
  oauthConsent,
  user,
  verification,
} from '@zntr/auth/schema'
import { requireMcpAuth } from '@zntr/auth/server'
import { getMcpOAuthAuth } from '@/lib/mcp/auth-helpers'
import { MCP_ISSUER, MCP_JWKS_URL, MCP_RESOURCE } from '@/lib/mcp/oauth-config'

function origin() {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.BETTER_AUTH_URL ??
    'http://localhost:3000'
  ).replace(/\/$/, '')
}

async function responseTarget(response: Response): Promise<string | null> {
  const location = response.headers.get('location')
  if (location) return new URL(location, origin()).toString()
  const body = (await response.json().catch(() => null)) as {
    url?: unknown
    redirect_uri?: unknown
  } | null
  if (typeof body?.url === 'string') return body.url
  return typeof body?.redirect_uri === 'string' ? body.redirect_uri : null
}

export async function smokeMcpOAuth() {
  const db = getDb()
  const suffix = crypto.randomUUID()
  const userId = `oauth-smoke-user-${suffix}`
  const accountId = `oauth-smoke-account-${suffix}`
  const email = `oauth-smoke-${suffix}@example.invalid`
  const password = crypto.randomBytes(24).toString('base64url')
  const redirectUri = 'http://127.0.0.1:45678/callback'
  let clientId: string | null = null

  const verifyAccess = async (accessToken: string) => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url === MCP_JWKS_URL) {
        return auth.handler(
          input instanceof Request ? input : new Request(url, init),
        )
      }
      return originalFetch(input, init)
    }
    try {
      const handler = requireMcpAuth(
        auth,
        async (_request, claims) =>
          Response.json({
            active: Boolean(await getMcpOAuthAuth(claims, MCP_RESOURCE)),
          }),
        {
          resource: MCP_RESOURCE,
          issuer: MCP_ISSUER,
          jwksUrl: MCP_JWKS_URL,
        },
      )
      const response = await handler(
        new Request(MCP_RESOURCE, {
          method: 'POST',
          headers: { authorization: `Bearer ${accessToken}` },
        }),
      )
      const body = (await response.json().catch(() => null)) as {
        active?: unknown
      } | null
      return { status: response.status, active: body?.active === true }
    } finally {
      globalThis.fetch = originalFetch
    }
  }

  try {
    await db.transaction(async (tx) => {
      const now = new Date()
      await tx.insert(user).values({
        id: userId,
        name: 'OAuth smoke test',
        email,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      })
      await tx.insert(account).values({
        id: accountId,
        issuer: 'local:credential',
        accountId: userId,
        providerId: 'credential',
        userId,
        password: await bcrypt.hash(password, 10),
        createdAt: now,
        updatedAt: now,
      })
    })

    const registration = await auth.handler(
      new Request(`${origin()}/api/auth/oauth2/register`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: origin(),
        },
        body: JSON.stringify({
          client_name: 'Zentra OAuth end-to-end smoke',
          application_type: 'native',
          redirect_uris: [redirectUri],
          token_endpoint_auth_method: 'none',
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          scope: 'offline_access events:read',
        }),
      }),
    )
    const registered = (await registration.json()) as { client_id?: unknown }
    clientId =
      typeof registered.client_id === 'string' ? registered.client_id : null
    if (!registration.ok || !clientId) throw new Error('registration')

    const signIn = await auth.handler(
      new Request(`${origin()}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: origin(),
        },
        body: JSON.stringify({ email, password }),
      }),
    )
    const cookie = signIn.headers.get('set-cookie')?.split(';')[0]
    if (!signIn.ok || !cookie) throw new Error('sign-in')

    const verifier = crypto.randomBytes(48).toString('base64url')
    const challenge = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url')
    const authorizeUrl = new URL(`${origin()}/api/auth/oauth2/authorize`)
    authorizeUrl.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'offline_access events:read',
      resource: `${origin()}/api/mcp`,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: 'smoke-state',
    }).toString()
    const authorization = await auth.handler(
      new Request(authorizeUrl, {
        headers: { accept: 'text/html', cookie },
      }),
    )
    const consentTarget = await responseTarget(authorization)
    if (
      authorization.status !== 302 ||
      !consentTarget ||
      new URL(consentTarget).pathname !== '/oauth/consent'
    ) {
      throw new Error('authorization')
    }

    const consent = await auth.handler(
      new Request(`${origin()}/api/auth/oauth2/consent`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          cookie,
          origin: origin(),
        },
        body: JSON.stringify({
          accept: true,
          oauth_query: new URL(consentTarget).searchParams.toString(),
        }),
      }),
    )
    const callbackTarget = await responseTarget(consent)
    const code = callbackTarget
      ? new URL(callbackTarget).searchParams.get('code')
      : null
    if (consent.status >= 400 || !code) {
      const targetUrl = callbackTarget ? new URL(callbackTarget) : null
      throw new Error(
        `consent:${consent.status}:${targetUrl?.pathname ?? 'none'}:${targetUrl?.searchParams.get('error') ?? 'no-code'}`,
      )
    }

    const token = await auth.handler(
      new Request(`${origin()}/api/auth/oauth2/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          code_verifier: verifier,
          redirect_uri: redirectUri,
          client_id: clientId,
          resource: `${origin()}/api/mcp`,
        }),
      }),
    )
    const tokens = (await token.json()) as {
      access_token?: unknown
      refresh_token?: unknown
      error?: unknown
      error_description?: unknown
    }
    if (
      !token.ok ||
      typeof tokens.access_token !== 'string' ||
      typeof tokens.refresh_token !== 'string'
    ) {
      throw new Error(
        `token:${token.status}:${typeof tokens.error === 'string' ? tokens.error : 'unknown'}:${typeof tokens.error_description === 'string' ? tokens.error_description : 'no-description'}`,
      )
    }

    const verified = await verifyAccess(tokens.access_token)
    if (verified.status !== 200 || !verified.active) {
      throw new Error('jwt-verification')
    }

    const refreshRequest = () =>
      auth.handler(
        new Request(`${origin()}/api/auth/oauth2/token`, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: tokens.refresh_token as string,
            client_id: clientId as string,
            resource: `${origin()}/api/mcp`,
          }),
        }),
      )
    const refreshed = await refreshRequest()
    const refreshedTokens = (await refreshed
      .clone()
      .json()
      .catch(() => null)) as {
      access_token?: unknown
    } | null
    const replayed = await refreshRequest()
    const replayBody = (await replayed.json()) as { error?: unknown }
    if (
      !refreshed.ok ||
      replayed.status !== 400 ||
      replayBody.error !== 'invalid_grant'
    ) {
      throw new Error('refresh-replay')
    }

    await db
      .delete(oauthConsent)
      .where(
        and(
          eq(oauthConsent.userId, userId),
          eq(oauthConsent.clientId, clientId),
        ),
      )
    if (typeof refreshedTokens?.access_token !== 'string') {
      throw new Error('refreshed-access-token')
    }
    const revoked = await verifyAccess(refreshedTokens.access_token)
    if (revoked.status !== 200 || revoked.active) {
      throw new Error('consent-revocation')
    }

    return {
      registration: registration.status,
      signIn: signIn.status,
      authorization: authorization.status,
      consent: consent.status,
      token: token.status,
      refresh: refreshed.status,
      replay: replayed.status,
      jwtVerification: verified.status,
      consentRevocation: revoked.active ? 'failed' : 'immediate',
    }
  } finally {
    await db.delete(verification).where(like(verification.value, `%${userId}%`))
    await db.delete(user).where(eq(user.id, userId))
    if (clientId) {
      await db.delete(oauthClient).where(eq(oauthClient.clientId, clientId))
    }
  }
}

if (process.argv[1]?.endsWith('smoke-mcp-oauth.ts')) {
  void smokeMcpOAuth().then(
    (result) => {
      console.info('[mcp-oauth-smoke]', result)
      process.exit(0)
    },
    (error: unknown) => {
      console.error(
        '[mcp-oauth-smoke] failed',
        error instanceof Error ? error.message : 'unknown',
      )
      process.exit(1)
    },
  )
}
