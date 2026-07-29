import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import {
  mcpDeviceCodes,
  mcpTokens,
  mcpAuthRequests,
} from '@/lib/drizzle/schema'
import { eq, and, gte } from 'drizzle-orm'
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  getFullUserInfo,
} from '@/lib/mcp/auth'
import crypto from 'crypto'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const grantType = body.grant_type

    // --- Device Code Grant ---
    if (grantType === 'urn:ietf:params:oauth:grant-type:device_code') {
      return handleDeviceCodeGrant(body)
    }

    // --- Authorization Code Grant (PKCE) ---
    if (grantType === 'authorization_code') {
      return handleAuthorizationCodeGrant(body)
    }

    return NextResponse.json(
      { error: 'unsupported_grant_type' },
      { status: 400 },
    )
  } catch {
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 },
    )
  }
}

async function handleDeviceCodeGrant(body: Record<string, unknown>) {
  const deviceCode = body.device_code as string | undefined
  if (!deviceCode) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing device_code' },
      { status: 400 },
    )
  }

  const hashedDeviceCode = hashToken(deviceCode)
  const db = await getDb()

  const [record] = await db
    .select()
    .from(mcpDeviceCodes)
    .where(eq(mcpDeviceCodes.deviceCode, hashedDeviceCode))

  if (!record) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Invalid device code' },
      { status: 400 },
    )
  }

  if (record.expiresAt < new Date()) {
    return NextResponse.json(
      { error: 'expired_token', error_description: 'Device code expired' },
      { status: 400 },
    )
  }

  if (record.status === 'pending') {
    return NextResponse.json(
      { error: 'authorization_pending' },
      { status: 400 },
    )
  }

  if (record.status !== 'approved' || !record.userId) {
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 })
  }

  return issueTokens(
    record.userId,
    record.scopes as string[],
    record.clientId,
    record.clientName,
  )
}

async function handleAuthorizationCodeGrant(body: Record<string, unknown>) {
  const code = body.code as string | undefined
  const codeVerifier = body.code_verifier as string | undefined
  const redirectUri = body.redirect_uri as string | undefined
  const clientId = body.client_id as string | undefined

  if (!code) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing code' },
      { status: 400 },
    )
  }

  const db = await getDb()

  const [record] = await db
    .select()
    .from(mcpAuthRequests)
    .where(
      and(
        eq(mcpAuthRequests.authorizationCode, code),
        eq(mcpAuthRequests.status, 'approved'),
        gte(mcpAuthRequests.codeExpiresAt, new Date()),
      ),
    )

  if (!record) {
    return NextResponse.json(
      {
        error: 'invalid_grant',
        error_description: 'Invalid or expired authorization code',
      },
      { status: 400 },
    )
  }

  // Verify redirect_uri
  if (redirectUri && record.redirectUri && redirectUri !== record.redirectUri) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'redirect_uri mismatch' },
      { status: 400 },
    )
  }

  // Verify client_id
  if (clientId && clientId !== record.clientId) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'client_id mismatch' },
      { status: 400 },
    )
  }

  // PKCE verification
  if (record.codeChallenge && record.codeChallengeMethod) {
    if (!codeVerifier) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Missing code_verifier' },
        { status: 400 },
      )
    }

    const expectedChallenge = await generateCodeChallenge(
      codeVerifier,
      record.codeChallengeMethod,
    )
    if (expectedChallenge !== record.codeChallenge) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'code_verifier mismatch' },
        { status: 400 },
      )
    }
  }

  // Mark code as used
  await db
    .update(mcpAuthRequests)
    .set({ status: 'used' })
    .where(eq(mcpAuthRequests.id, record.id))

  if (!record.userId) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'No user associated' },
      { status: 400 },
    )
  }

  return issueTokens(
    record.userId,
    record.scopes as string[],
    record.clientId,
    record.clientId.slice(0, 12) + '...',
  )
}

function generateCodeChallenge(verifier: string, method: string): string {
  if (method === 'S256') {
    const hash = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url')
    return hash.replace(/=/g, '')
  }
  return verifier
}

async function issueTokens(
  userId: string,
  scopes: string[],
  clientId: string,
  clientName: string,
) {
  const accessToken = generateAccessToken()
  const refreshToken = generateRefreshToken()
  const userInfo = await getFullUserInfo(userId)

  const db = await getDb()
  await db.insert(mcpTokens).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash: hashToken(accessToken),
    refreshTokenHash: hashToken(refreshToken),
    tokenType: 'bearer',
    scopes,
    clientId,
    clientName,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    refreshExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  })

  return NextResponse.json({
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 86400,
    refresh_token: refreshToken,
    scope: scopes.join(' '),
    user: { id: userId, name: userInfo.name, email: userInfo.email },
  })
}
