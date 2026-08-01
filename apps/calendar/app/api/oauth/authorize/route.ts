import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import { mcpDeviceCodes, mcpAuthRequests } from '@/lib/drizzle/schema'
import { eq, and, gte } from 'drizzle-orm'
import crypto from 'crypto'

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
    const userId = body.user_id

    if (!userId) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing user_id' },
        { status: 400 },
      )
    }

    // Handle Device Code Grant flow
    if (body.user_code || body.code) {
      const userCode = body.user_code || body.code
      const db = await getDb()

      const [record] = await db
        .select()
        .from(mcpDeviceCodes)
        .where(
          and(
            eq(mcpDeviceCodes.userCode, userCode),
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

      try {
        const uri = new URL(redirectUri)
        if (
          uri.protocol !== 'https:' &&
          !(
            uri.hostname === 'localhost' ||
            uri.hostname === '127.0.0.1'
          )
        ) {
          return NextResponse.json(
            {
              error: 'invalid_request',
              error_description:
                'redirect_uri must use HTTPS (except localhost)',
            },
            { status: 400 },
          )
        }
      } catch {
        return NextResponse.json(
          {
            error: 'invalid_request',
            error_description: 'Invalid redirect_uri',
          },
          { status: 400 },
        )
      }

      const authorizationCode = crypto.randomUUID()
      const db = await getDb()

      await db.insert(mcpAuthRequests).values({
        id: crypto.randomUUID(),
        userId,
        clientId,
        redirectUri,
        scopes: scope.split(' ').filter(Boolean),
        codeChallenge: codeChallenge ?? null,
        codeChallengeMethod: codeChallengeMethod ?? null,
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
