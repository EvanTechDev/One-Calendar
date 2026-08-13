import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import { mcpDeviceCodes, mcpOauthClients } from '@/lib/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import {
  generateDeviceCode,
  generateUserCode,
  hashToken,
  verifyOAuthClientSecret,
} from '@/lib/mcp/auth'
import { withRedis } from '@/lib/cache/client'
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
    const clientId = body.client_id
    const clientName = body.client_name || body.client_id || 'Unknown Client'
    const scopes = body.scope ? body.scope.split(' ') : ['events:read']

    if (!clientId) {
      return NextResponse.json(
        {
          error: 'invalid_client',
          error_description: 'Missing client_id',
        },
        { status: 400 },
      )
    }

    const db = await getDb()

    const [client] = await db
      .select({
        tokenEndpointAuthMethod: mcpOauthClients.tokenEndpointAuthMethod,
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

    if (client.tokenEndpointAuthMethod !== 'none') {
      let secret = body.client_secret
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

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown'
    const throttleKey = `mcp:device:issue:${ip}:${clientId}`
    const allowed = await withRedis<boolean>(
      async (redis) => {
        const count = await redis.incr(throttleKey)
        if (count === 1) await redis.expire(throttleKey, 60)
        return count <= 10
      },
      async () => true,
    )
    if (!allowed) {
      return NextResponse.json(
        {
          error: 'slow_down',
          error_description:
            'Too many device code requests, try again in a minute',
        },
        { status: 429 },
      )
    }

    const deviceCode = generateDeviceCode()
    const userCode = generateUserCode()

    await db.insert(mcpDeviceCodes).values({
      id: crypto.randomUUID(),
      deviceCode: hashToken(deviceCode),
      userCode: hashToken(userCode),
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
