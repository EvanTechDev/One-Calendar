import { createHash } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authorizationCodes, grants, refreshTokens } from '@/lib/schema'
import { randomToken, signToken, validatePkceVerifier, verifyCodeChallenge } from '@/lib/oauth'

function issuer(req: NextRequest) {
  return process.env.DS_ISSUER_URL?.trim() ?? req.nextUrl.origin
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const grantType = String(body.grant_type ?? '')

  if (grantType === 'authorization_code') {
    const code = String(body.code ?? '')
    const clientId = String(body.client_id ?? '')
    const redirectUri = String(body.redirect_uri ?? '')
    const codeVerifier = String(body.code_verifier ?? '')

    if (!validatePkceVerifier(codeVerifier)) {
      return NextResponse.json({ error: 'invalid_code_verifier' }, { status: 400 })
    }

    const found = await db
      .select()
      .from(authorizationCodes)
      .where(and(eq(authorizationCodes.code, code), gt(authorizationCodes.expiresAt, new Date())))
      .limit(1)

    const row = found[0]
    if (!row) return NextResponse.json({ error: 'invalid_grant' }, { status: 400 })
    if (row.clientId !== clientId || row.redirectUri !== redirectUri) {
      return NextResponse.json({ error: 'invalid_client_or_redirect' }, { status: 400 })
    }
    if (row.codeChallengeMethod !== 'S256' || !verifyCodeChallenge(codeVerifier, row.codeChallenge)) {
      return NextResponse.json({ error: 'invalid_pkce' }, { status: 400 })
    }

    await db.delete(authorizationCodes).where(eq(authorizationCodes.code, code))

    const grantId = createHash('sha256').update(`${row.did}:${clientId}`).digest('hex')
    const grantExists = await db.select().from(grants).where(eq(grants.id, grantId)).limit(1)
    if (!grantExists[0]) return NextResponse.json({ error: 'invalid_grant' }, { status: 400 })

    const tokenId = randomToken(24)
    await db.insert(refreshTokens).values({
      tokenId,
      did: row.did,
      clientId,
      scope: row.scope,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })

    const iss = issuer(req)
    const accessToken = await signToken({
      sub: row.did,
      client_id: clientId,
      iss,
      scope: row.scope,
      type: 'access',
    })
    const refreshToken = await signToken({
      sub: row.did,
      client_id: clientId,
      iss,
      scope: row.scope,
      type: 'refresh',
      jti: tokenId,
    })

    return NextResponse.json({
      token_type: 'Bearer',
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
      scope: row.scope,
    })
  }

  if (grantType === 'refresh_token') {
    const refreshToken = String(body.refresh_token ?? '')
    const clientId = String(body.client_id ?? '')
    try {
      const payloadPart = refreshToken.split('.')[1]
      const decoded = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as { jti?: string }
      const tokenId = decoded.jti
      if (!tokenId) return NextResponse.json({ error: 'invalid_refresh_token' }, { status: 400 })

      const found = await db
        .select()
        .from(refreshTokens)
        .where(and(eq(refreshTokens.tokenId, tokenId), gt(refreshTokens.expiresAt, new Date())))
        .limit(1)

      const row = found[0]
      if (!row || row.clientId !== clientId) {
        return NextResponse.json({ error: 'invalid_refresh_token' }, { status: 400 })
      }

      const accessToken = await signToken({
        sub: row.did,
        client_id: clientId,
        iss: issuer(req),
        scope: row.scope,
        type: 'access',
      })

      return NextResponse.json({ token_type: 'Bearer', access_token: accessToken, expires_in: 3600, scope: row.scope })
    } catch {
      return NextResponse.json({ error: 'invalid_refresh_token' }, { status: 400 })
    }
  }

  return NextResponse.json({ error: 'unsupported_grant_type' }, { status: 400 })
}
