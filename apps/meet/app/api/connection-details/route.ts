import { NextRequest, NextResponse } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'
import type { AccessTokenOptions, VideoGrant } from 'livekit-server-sdk'
import { getServerSession } from '@/lib/auth/server'
import { randomString, resolveRegionalUrl } from '@/lib/meet-utils'
import type { ConnectionDetails } from '@/lib/types'

const IDENTITY_COOKIE = 'meet-identity-suffix'
const IDENTITY_COOKIE_MAX_AGE = 60 * 60 * 2 // 2 hours
const TOKEN_TTL = '5m'

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET
    const livekitUrl = process.env.LIVEKIT_URL
    if (!apiKey || !apiSecret || !livekitUrl) {
      return NextResponse.json(
        { error: 'Server is missing LiveKit configuration' },
        { status: 500 },
      )
    }

    const body = (await request.json()) as {
      roomName?: string
      participantName?: string
      region?: string
    }
    const roomName = body.roomName?.trim()
    if (!roomName) {
      return NextResponse.json(
        { error: 'roomName is required' },
        { status: 400 },
      )
    }

    // Prefer the authenticated user's name; fall back to the name typed in
    // the pre-join screen for guests.
    const session = await getServerSession()
    const participantName =
      session?.user.name || body.participantName?.trim() || ''
    if (!participantName) {
      return NextResponse.json(
        { error: 'participantName is required' },
        { status: 400 },
      )
    }

    // Keep the identity stable per-browser so reconnects resume the same
    // participant, while still avoiding collisions between browsers.
    const existingSuffix = request.cookies.get(IDENTITY_COOKIE)?.value
    const suffix =
      existingSuffix && /^[a-z0-9]{4}$/.test(existingSuffix)
        ? existingSuffix
        : randomString(4)

    const identity = session
      ? `user_${session.user.id}`
      : `${participantName}__${suffix}`

    const tokenOptions: AccessTokenOptions = {
      identity,
      name: participantName,
      ttl: TOKEN_TTL,
    }
    const grant: VideoGrant = {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    }

    const accessToken = new AccessToken(apiKey, apiSecret, tokenOptions)
    accessToken.addGrant(grant)

    const payload: ConnectionDetails = {
      serverUrl: resolveRegionalUrl(livekitUrl, body.region),
      roomName,
      participantName,
      participantToken: await accessToken.toJwt(),
    }

    const response = NextResponse.json(payload)
    if (!session && !existingSuffix) {
      response.cookies.set(IDENTITY_COOKIE, suffix, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: IDENTITY_COOKIE_MAX_AGE,
        path: '/',
      })
    }
    return response
  } catch (error) {
    console.error('[connection-details]', error)
    return NextResponse.json(
      { error: 'Failed to create connection details' },
      { status: 500 },
    )
  }
}
