import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { and, eq, gte } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/drizzle/client'
import {
  mcpAuthRequests,
  mcpDeviceCodes,
  mcpOauthClients,
  mcpTokens,
} from '@/lib/drizzle/schema'
import {
  generateAccessToken,
  generateCodeChallenge,
  generateRefreshToken,
  getUserNameAndEmail,
  hashAuthorizationCode,
  hashToken,
} from '@/lib/mcp/auth'

export const runtime = 'nodejs'

const ACCESS_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000
const ACCESS_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60
const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000

const tokenRequestSchema = z
  .object({
    grant_type: z.string().min(1),
    device_code: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
    code_verifier: z.string().min(1).optional(),
    redirect_uri: z.string().min(1).optional(),
    client_id: z.string().min(1).optional(),
    client_secret: z.string().optional(),
    refresh_token: z.string().min(1).optional(),
  })
  .passthrough()

type TokenRequest = z.infer<typeof tokenRequestSchema>
type TokenWriter = Pick<Awaited<ReturnType<typeof getDb>>, 'insert'>

function oauthError(error: string, errorDescription?: string, status = 400) {
  return NextResponse.json(
    {
      error,
      ...(errorDescription ? { error_description: errorDescription } : {}),
    },
    { status },
  )
}

async function parseBody(request: NextRequest): Promise<TokenRequest | null> {
  try {
    const contentType = request.headers.get('content-type') ?? ''
    let input: unknown
    if (contentType.includes('application/x-www-form-urlencoded')) {
      input = Object.fromEntries(new URLSearchParams(await request.text()))
    } else {
      input = await request.json()
    }
    const parsed = tokenRequestSchema.safeParse(input)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function basicCredentials(request: NextRequest) {
  const authorization = request.headers.get('authorization') ?? ''
  const match = /^Basic\s+([^\s]+)$/i.exec(authorization)
  if (!match) return null

  try {
    const decoded = Buffer.from(match[1]!, 'base64').toString('utf8')
    const separator = decoded.indexOf(':')
    if (separator < 0) return null
    return {
      clientId: decodeURIComponent(decoded.slice(0, separator)),
      clientSecret: decodeURIComponent(decoded.slice(separator + 1)),
    }
  } catch {
    return null
  }
}

/** Authenticates the request against the client bound to the stored grant. */
async function authenticateClient(
  storedClientId: string,
  request: NextRequest,
  bodyClientId?: string,
  bodyClientSecret?: string,
): Promise<boolean> {
  const basic = basicCredentials(request)
  if (
    (bodyClientId && bodyClientId !== storedClientId) ||
    (basic && basic.clientId !== storedClientId)
  ) {
    return false
  }

  const db = await getDb()
  const [client] = await db
    .select({
      clientSecretHash: mcpOauthClients.clientSecretHash,
    })
    .from(mcpOauthClients)
    .where(
      and(
        eq(mcpOauthClients.id, storedClientId),
        eq(mcpOauthClients.isRevoked, false),
      ),
    )

  if (!client) return false
  if (!client.clientSecretHash) return true

  const secret = basic?.clientSecret ?? bodyClientSecret
  return typeof secret === 'string'
    ? bcrypt.compare(secret, client.clientSecretHash)
    : false
}

async function issueTokens(
  db: TokenWriter,
  input: {
    userId: string
    scopes: string[]
    clientId: string
    clientName: string
    user: { name: string; email: string }
  },
) {
  const accessToken = generateAccessToken()
  const refreshToken = generateRefreshToken()

  await db.insert(mcpTokens).values({
    id: crypto.randomUUID(),
    userId: input.userId,
    tokenHash: hashToken(accessToken),
    refreshTokenHash: hashToken(refreshToken),
    tokenType: 'bearer',
    scopes: input.scopes,
    clientId: input.clientId,
    clientName: input.clientName,
    expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS),
    refreshExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  })

  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: input.scopes.join(' '),
    user: { id: input.userId, ...input.user },
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request)
    if (!body) return oauthError('invalid_request', 'Malformed token request')

    if (body.grant_type === 'urn:ietf:params:oauth:grant-type:device_code') {
      return handleDeviceCodeGrant(body, request)
    }
    if (body.grant_type === 'authorization_code') {
      return handleAuthorizationCodeGrant(body, request)
    }
    if (body.grant_type === 'refresh_token') {
      return handleRefreshTokenGrant(body, request)
    }
    return oauthError('unsupported_grant_type')
  } catch {
    return oauthError('server_error', 'Internal server error', 500)
  }
}

async function handleDeviceCodeGrant(body: TokenRequest, request: NextRequest) {
  if (!body.device_code) {
    return oauthError('invalid_request', 'Missing device_code')
  }

  const db = await getDb()
  const [record] = await db
    .select()
    .from(mcpDeviceCodes)
    .where(eq(mcpDeviceCodes.deviceCode, hashToken(body.device_code)))

  if (!record) return oauthError('invalid_grant', 'Invalid device code')
  if (
    !(await authenticateClient(
      record.clientId,
      request,
      body.client_id,
      body.client_secret,
    ))
  ) {
    return oauthError('invalid_client', 'Client authentication failed')
  }
  if (record.expiresAt < new Date()) {
    return oauthError('expired_token', 'Device code expired')
  }
  if (record.status === 'pending') return oauthError('authorization_pending')
  if (record.status !== 'approved' || !record.userId) {
    return oauthError('invalid_grant')
  }

  const user = await getUserNameAndEmail(record.userId)
  const result = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(mcpDeviceCodes)
      .set({ status: 'used' })
      .where(
        and(
          eq(mcpDeviceCodes.id, record.id),
          eq(mcpDeviceCodes.status, 'approved'),
          gte(mcpDeviceCodes.expiresAt, new Date()),
        ),
      )
      .returning({ id: mcpDeviceCodes.id })
    if (!claimed) return null

    return issueTokens(tx, {
      userId: record.userId!,
      scopes: record.scopes as string[],
      clientId: record.clientId,
      clientName: record.clientName,
      user,
    })
  })

  return result
    ? NextResponse.json(result)
    : oauthError('invalid_grant', 'Device code already redeemed')
}

async function handleAuthorizationCodeGrant(
  body: TokenRequest,
  request: NextRequest,
) {
  if (!body.code) return oauthError('invalid_request', 'Missing code')

  const db = await getDb()
  const [record] = await db
    .select()
    .from(mcpAuthRequests)
    .where(
      and(
        eq(mcpAuthRequests.authorizationCode, hashAuthorizationCode(body.code)),
        eq(mcpAuthRequests.status, 'approved'),
        gte(mcpAuthRequests.codeExpiresAt, new Date()),
      ),
    )

  if (!record) {
    return oauthError('invalid_grant', 'Invalid or expired authorization code')
  }
  if (
    !(await authenticateClient(
      record.clientId,
      request,
      body.client_id,
      body.client_secret,
    ))
  ) {
    return oauthError('invalid_client', 'Client authentication failed')
  }
  if (!body.redirect_uri || body.redirect_uri !== record.redirectUri) {
    return oauthError('invalid_grant', 'redirect_uri mismatch')
  }
  if (!record.codeChallenge || !body.code_verifier) {
    return oauthError('invalid_grant', 'Missing PKCE verifier')
  }
  const expectedChallenge = generateCodeChallenge(
    body.code_verifier,
    record.codeChallengeMethod ?? 'S256',
  )
  if (expectedChallenge !== record.codeChallenge) {
    return oauthError('invalid_grant', 'code_verifier mismatch')
  }
  if (!record.userId) return oauthError('invalid_grant', 'No user associated')

  const user = await getUserNameAndEmail(record.userId)
  const result = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(mcpAuthRequests)
      .set({ status: 'used' })
      .where(
        and(
          eq(mcpAuthRequests.id, record.id),
          eq(mcpAuthRequests.status, 'approved'),
          gte(mcpAuthRequests.codeExpiresAt, new Date()),
        ),
      )
      .returning({ id: mcpAuthRequests.id })
    if (!claimed) return null

    return issueTokens(tx, {
      userId: record.userId!,
      scopes: record.scopes as string[],
      clientId: record.clientId,
      clientName: `${record.clientId.slice(0, 12)}...`,
      user,
    })
  })

  return result
    ? NextResponse.json(result)
    : oauthError('invalid_grant', 'Authorization code already redeemed')
}

async function handleRefreshTokenGrant(
  body: TokenRequest,
  request: NextRequest,
) {
  if (!body.refresh_token) {
    return oauthError('invalid_request', 'Missing refresh_token')
  }

  const db = await getDb()
  const [record] = await db
    .select()
    .from(mcpTokens)
    .where(eq(mcpTokens.refreshTokenHash, hashToken(body.refresh_token)))

  if (!record || record.isRevoked) return oauthError('invalid_grant')
  if (
    !(await authenticateClient(
      record.clientId,
      request,
      body.client_id,
      body.client_secret,
    ))
  ) {
    return oauthError('invalid_client', 'Client authentication failed')
  }
  if (record.refreshExpiresAt && record.refreshExpiresAt < new Date()) {
    return oauthError('invalid_grant')
  }

  const user = await getUserNameAndEmail(record.userId)
  const result = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(mcpTokens)
      .set({ isRevoked: true })
      .where(
        and(
          eq(mcpTokens.id, record.id),
          eq(mcpTokens.isRevoked, false),
          record.refreshExpiresAt
            ? gte(mcpTokens.refreshExpiresAt, new Date())
            : undefined,
        ),
      )
      .returning({ id: mcpTokens.id })
    if (!claimed) return null

    return issueTokens(tx, {
      userId: record.userId,
      scopes: record.scopes as string[],
      clientId: record.clientId,
      clientName: record.clientName,
      user,
    })
  })

  return result
    ? NextResponse.json(result)
    : oauthError('invalid_grant', 'Refresh token already redeemed')
}
