import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import {
  mcpDeviceCodes,
  mcpTokens,
  mcpAuthRequests,
  mcpOauthClients,
} from '@/lib/drizzle/schema'
import { eq, and, gte } from 'drizzle-orm'
import {
  generateAccessToken,
  generateCodeChallenge,
  generateRefreshToken,
  hashToken,
  verifyOAuthClientSecret,
  getUserNameAndEmail,
} from '@/lib/mcp/auth'
import crypto from 'crypto'

export const runtime = 'nodejs'

const ACCESS_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000
const ACCESS_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60

async function parseBody(
  request: NextRequest,
): Promise<Record<string, string>> {
  const ct = request.headers.get('content-type') || ''
  if (ct.includes('application/x-www-form-urlencoded')) {
    const text = await request.text()
    const params = new URLSearchParams(text)
    return Object.fromEntries(params.entries())
  }
  return request.json().catch(() => ({}))
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request)
    const grantType = body.grant_type

    // --- Device Code Grant ---
    if (grantType === 'urn:ietf:params:oauth:grant-type:device_code') {
      return handleDeviceCodeGrant(body)
    }

    // --- Authorization Code Grant (PKCE) ---
    if (grantType === 'authorization_code') {
      return handleAuthorizationCodeGrant(body, request)
    }

    // --- Refresh Token Grant ---
    if (grantType === 'refresh_token') {
      return handleRefreshTokenGrant(body)
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

async function handleAuthorizationCodeGrant(
  body: Record<string, unknown>,
  request: NextRequest,
) {
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

  if (!clientId) {
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'Missing client_id' },
      { status: 400 },
    )
  }

  const db = await getDb()

  const [client] = await db
    .select({
      clientSecretHash: mcpOauthClients.clientSecretHash,
    })
    .from(mcpOauthClients)
    .where(
      and(
        eq(mcpOauthClients.id, clientId),
        eq(mcpOauthClients.isRevoked, false),
      ),
    )

  if (!client) {
    return NextResponse.json(
      {
        error: 'invalid_client',
        error_description: 'Unknown or revoked client_id',
      },
      { status: 400 },
    )
  }

  if (client.clientSecretHash) {
    let secret = body.client_secret as string | undefined
    const authHeader = request.headers.get('authorization') || ''
    if (authHeader.startsWith('Basic ')) {
      try {
        const decoded = Buffer.from(
          authHeader.slice(6),
          'base64',
        ).toString('utf8')
        secret = decoded.includes(':') ? decoded.split(':')[1] : undefined
      } catch {
        secret = undefined
      }
    }

    if (!(await verifyOAuthClientSecret(clientId, secret))) {
      return NextResponse.json(
        {
          error: 'invalid_client',
          error_description: 'Invalid client secret',
        },
        { status: 400 },
      )
    }
  }

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

  if (record.clientId !== clientId) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'client_id mismatch' },
      { status: 400 },
    )
  }

  if (!redirectUri || redirectUri !== record.redirectUri) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'redirect_uri mismatch' },
      { status: 400 },
    )
  }

  if (!record.codeChallenge) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'PKCE not required' },
      { status: 400 },
    )
  }

  if (!codeVerifier) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Missing code_verifier' },
      { status: 400 },
    )
  }

  const expectedChallenge = generateCodeChallenge(
    codeVerifier,
    record.codeChallengeMethod ?? 'S256',
  )
  if (expectedChallenge !== record.codeChallenge) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'code_verifier mismatch' },
      { status: 400 },
    )
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

async function handleRefreshTokenGrant(body: Record<string, unknown>) {
  const refreshToken = body.refresh_token as string | undefined
  const clientId = body.client_id as string | undefined

  if (!refreshToken) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing refresh_token' },
      { status: 400 },
    )
  }

  const refreshTokenHash = hashToken(refreshToken)
  const db = await getDb()

  const [record] = await db
    .select()
    .from(mcpTokens)
    .where(eq(mcpTokens.refreshTokenHash, refreshTokenHash))

  if (!record || record.isRevoked) {
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 })
  }

  if (record.refreshExpiresAt && record.refreshExpiresAt < new Date()) {
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 })
  }

  if (clientId && clientId !== record.clientId) {
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 })
  }

  return issueTokens(
    record.userId,
    record.scopes as string[],
    record.clientId,
    record.clientName,
  )
}

async function issueTokens(
  userId: string,
  scopes: string[],
  clientId: string,
  clientName: string,
) {
  const accessToken = generateAccessToken()
  const refreshToken = generateRefreshToken()
  const userInfo = await getUserNameAndEmail(userId)

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
    expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS),
    refreshExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  })

  return NextResponse.json({
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: scopes.join(' '),
    user: { id: userId, name: userInfo.name, email: userInfo.email },
  })
}
