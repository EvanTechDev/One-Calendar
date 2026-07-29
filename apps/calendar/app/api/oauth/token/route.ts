import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import { mcpDeviceCodes, mcpTokens } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'
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

    if (grantType !== 'urn:ietf:params:oauth:grant-type:device_code') {
      return NextResponse.json(
        { error: 'unsupported_grant_type' },
        { status: 400 },
      )
    }

    const deviceCode = body.device_code
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

    const accessToken = generateAccessToken()
    const refreshToken = generateRefreshToken()
    const userInfo = await getFullUserInfo(record.userId)

    await db.insert(mcpTokens).values({
      id: crypto.randomUUID(),
      userId: record.userId,
      tokenHash: hashToken(accessToken),
      refreshTokenHash: hashToken(refreshToken),
      tokenType: 'bearer',
      scopes: record.scopes,
      clientId: record.clientId,
      clientName: record.clientName,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      refreshExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    })

    await db
      .update(mcpDeviceCodes)
      .set({ status: 'used' })
      .where(eq(mcpDeviceCodes.id, record.id))

    return NextResponse.json({
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 86400,
      refresh_token: refreshToken,
      scope: record.scopes.join(' '),
      user: {
        id: record.userId,
        name: userInfo.name,
        email: userInfo.email,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 },
    )
  }
}
