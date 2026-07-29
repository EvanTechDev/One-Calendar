import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import { mcpDeviceCodes } from '@/lib/drizzle/schema'
import { generateDeviceCode, generateUserCode, hashToken } from '@/lib/mcp/auth'
import crypto from 'crypto'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const clientId = body.client_id || 'unknown'
    const clientName = body.client_name || body.client_id || 'Unknown Client'
    const scopes = body.scope ? body.scope.split(' ') : ['events:read']

    const deviceCode = generateDeviceCode()
    const userCode = generateUserCode()

    const db = await getDb()
    await db.insert(mcpDeviceCodes).values({
      id: crypto.randomUUID(),
      deviceCode: hashToken(deviceCode),
      userCode,
      clientId,
      clientName,
      scopes,
      status: 'pending',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    })

    return NextResponse.json({
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: `${process.env.BETTER_AUTH_URL || 'http://localhost:3000'}/oauth/authorize`,
      verification_uri_complete: `${process.env.BETTER_AUTH_URL || 'http://localhost:3000'}/oauth/authorize?code=${userCode}`,
      expires_in: 300,
      interval: 5,
    })
  } catch {
    return NextResponse.json(
      {
        error: 'invalid_request',
        error_description: 'Failed to create device code',
      },
      { status: 400 },
    )
  }
}
