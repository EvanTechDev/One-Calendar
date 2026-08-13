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
import { hashToken, redirectUriAllowed } from '@/lib/mcp/auth'

export const runtime = 'nodejs'

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
        { error: 'access_denied', error_description: 'Authentication required' },
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
        scopes: scope.split(' ').filter(Boolean),
        codeChallenge,
        codeChallengeMethod,
        state: state ?? null,
        resource: resource ?? null,
        authorizationCode,
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
