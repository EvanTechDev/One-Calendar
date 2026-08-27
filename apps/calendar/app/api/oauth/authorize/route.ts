import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import { getServerSession } from '@/lib/auth/server'
import {
  mcpDeviceCodes,
  mcpAuthRequests,
  mcpOauthClients,
} from '@/lib/drizzle/schema'
import { eq, and, gte } from 'drizzle-orm'
import crypto from 'crypto'
import {
  hashAuthorizationCode,
  hashToken,
  parseRequestedScopes,
  redirectUriAllowed,
} from '@/lib/mcp/auth'

export const runtime = 'nodejs'

/**
 * Describes a pending device code so the consent screen can show the user what
 * they are approving. Requires a signed-in session so it is not an open oracle
 * for guessing user codes, and returns display data only — never the code.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user) {
    return NextResponse.json(
      { error: 'access_denied', error_description: 'Authentication required' },
      { status: 401 },
    )
  }

  const userCode = request.nextUrl.searchParams.get('user_code')
  const clientId = request.nextUrl.searchParams.get('client_id')
  const redirectUri = request.nextUrl.searchParams.get('redirect_uri')

  if (clientId && redirectUri) {
    const db = await getDb()
    const [client] = await db
      .select({
        isRevoked: mcpOauthClients.isRevoked,
        redirectUris: mcpOauthClients.redirectUris,
      })
      .from(mcpOauthClients)
      .where(eq(mcpOauthClients.id, clientId))

    if (!client || client.isRevoked) {
      return NextResponse.json(
        {
          error: 'invalid_client',
          error_description: 'Unknown or revoked client_id',
        },
        { status: 400 },
      )
    }

    const registeredRedirectUri = (client.redirectUris as string[]).find(
      (registered) => registered === redirectUri,
    )
    if (
      !registeredRedirectUri ||
      !redirectUriAllowed(client.redirectUris as string[], redirectUri)
    ) {
      return NextResponse.json(
        {
          error: 'invalid_request',
          error_description: 'redirect_uri not registered for this client',
        },
        { status: 400 },
      )
    }

    return NextResponse.json({ redirect_uri: registeredRedirectUri })
  }

  if (!userCode) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing user_code' },
      { status: 400 },
    )
  }

  const db = await getDb()
  const [record] = await db
    .select({
      clientName: mcpDeviceCodes.clientName,
      scopes: mcpDeviceCodes.scopes,
    })
    .from(mcpDeviceCodes)
    .where(
      and(
        eq(mcpDeviceCodes.userCode, hashToken(userCode)),
        eq(mcpDeviceCodes.status, 'pending'),
        gte(mcpDeviceCodes.expiresAt, new Date()),
      ),
    )

  if (!record) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Invalid or expired code' },
      { status: 400 },
    )
  }

  return NextResponse.json({
    client_name: record.clientName,
    scopes: record.scopes as string[],
  })
}

export async function POST(request: NextRequest) {
  try {
    const ct = request.headers.get('content-type') || ''
    let body: Record<string, string>
    if (ct.includes('application/x-www-form-urlencoded')) {
      const text = await request.text()
      body = Object.fromEntries(new URLSearchParams(text).entries())
    } else {
      body = await request.json().catch(() => ({}))
    }
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json(
        {
          error: 'access_denied',
          error_description: 'Authentication required',
        },
        { status: 401 },
      )
    }
    const userId = session.user.id

    // Handle Device Code Grant flow
    if (body.user_code || body.code) {
      const userCode = body.user_code || body.code
      const db = await getDb()

      const [record] = await db
        .select()
        .from(mcpDeviceCodes)
        .where(
          and(
            eq(mcpDeviceCodes.userCode, hashToken(userCode)),
            eq(mcpDeviceCodes.status, 'pending'),
            gte(mcpDeviceCodes.expiresAt, new Date()),
          ),
        )

      if (!record) {
        return NextResponse.json(
          {
            error: 'invalid_grant',
            error_description: 'Invalid or expired code',
          },
          { status: 400 },
        )
      }

      await db
        .update(mcpDeviceCodes)
        .set({ status: 'approved', userId })
        .where(eq(mcpDeviceCodes.id, record.id))

      return NextResponse.json({ success: true })
    }

    // Handle Authorization Code Grant flow (PKCE)
    if (body.response_type === 'code') {
      const clientId = body.client_id
      const redirectUri = body.redirect_uri
      const scope = body.scope ?? ''
      const codeChallenge = body.code_challenge
      const codeChallengeMethod = body.code_challenge_method
      const state = body.state
      const resource = body.resource

      if (!clientId || !redirectUri) {
        return NextResponse.json(
          {
            error: 'invalid_request',
            error_description: 'Missing client_id or redirect_uri',
          },
          { status: 400 },
        )
      }

      const db = await getDb()

      const [client] = await db
        .select({
          id: mcpOauthClients.id,
          isRevoked: mcpOauthClients.isRevoked,
          redirectUris: mcpOauthClients.redirectUris,
        })
        .from(mcpOauthClients)
        .where(and(eq(mcpOauthClients.id, clientId)))

      if (!client || client.isRevoked) {
        return NextResponse.json(
          {
            error: 'invalid_client',
            error_description: 'Unknown or revoked client_id',
          },
          { status: 400 },
        )
      }

      if (!redirectUriAllowed(client.redirectUris as string[], redirectUri)) {
        return NextResponse.json(
          {
            error: 'invalid_request',
            error_description: 'redirect_uri not registered for this client',
          },
          { status: 400 },
        )
      }

      if (!codeChallenge || codeChallengeMethod !== 'S256') {
        return NextResponse.json(
          {
            error: 'invalid_request',
            error_description: 'code_challenge with method S256 is required',
          },
          { status: 400 },
        )
      }

      const authorizationCode = crypto.randomUUID()

      await db.insert(mcpAuthRequests).values({
        id: crypto.randomUUID(),
        userId,
        clientId,
        redirectUri,
        scopes: parseRequestedScopes(scope),
        codeChallenge,
        codeChallengeMethod,
        state: state ?? null,
        resource: resource ?? null,
        // Stored hashed; only the client receives the plaintext below.
        authorizationCode: hashAuthorizationCode(authorizationCode),
        codeExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        status: 'approved',
      })

      return NextResponse.json({ code: authorizationCode })
    }

    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Unsupported flow' },
      { status: 400 },
    )
  } catch {
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 },
    )
  }
}
