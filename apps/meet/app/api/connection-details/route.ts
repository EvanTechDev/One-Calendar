import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'
import type { AccessTokenOptions, VideoGrant } from 'livekit-server-sdk'
import { getMeeting, isJoinable, verifyCreatorToken } from '@zntr/meetings'
import { getDb } from '@/lib/drizzle'
import { getServerSession } from '@/lib/auth/server'
import { checkFixedWindowLimit, clientAddress } from '@/lib/rate-limit'
import { randomString, resolveRegionalUrl } from '@/lib/meet-utils'
import type { ConnectionDetails } from '@/lib/types'

const IDENTITY_COOKIE = 'meet-identity-suffix'
const IDENTITY_COOKIE_MAX_AGE = 60 * 60 * 2 // 2 hours
const TOKEN_TTL = '5m'
const MAX_NAME_LENGTH = 100
const REGION_PATTERN = /^[a-z0-9-]{1,32}$/

interface ConnectionRequestBody {
  roomName?: string
  participantName?: string
  region?: string
  creatorToken?: string
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const livekitUrl = process.env.LIVEKIT_URL
  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json(
      { error: 'Server is missing LiveKit configuration' },
      { status: 500 },
    )
  }

  let body: ConnectionRequestBody
  try {
    body = (await request.json()) as ConnectionRequestBody
  } catch {
    return NextResponse.json({ error: 'Malformed request' }, { status: 400 })
  }

  const roomName = body.roomName?.trim()
  if (!roomName) {
    return NextResponse.json({ error: 'roomName is required' }, { status: 400 })
  }
  if (body.region !== undefined && !REGION_PATTERN.test(body.region)) {
    return NextResponse.json({ error: 'Invalid region' }, { status: 400 })
  }

  try {
    const limit = await checkFixedWindowLimit({
      name: 'meeting-token',
      subject: clientAddress(request),
      limit: 30,
      windowSeconds: 600,
    })
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many join attempts — try again shortly' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
      )
    }

    // A Meeting must exist and accept joins before any token is minted
    // (ADR 0016). This is what closes arbitrary-room token minting.
    const db = getDb()
    const meeting = await getMeeting(db, roomName)
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }
    if (!isJoinable(meeting)) {
      return NextResponse.json(
        { error: 'This meeting has ended' },
        { status: 410 },
      )
    }

    const session = await getServerSession()
    const rawName = session?.user.name || body.participantName?.trim() || ''
    if (!rawName) {
      return NextResponse.json(
        { error: 'participantName is required' },
        { status: 400 },
      )
    }
    const participantName = rawName.slice(0, MAX_NAME_LENGTH)

    // Keep the identity stable per-browser so reconnects resume the same
    // participant, while still avoiding collisions between browsers.
    const existingSuffix = request.cookies.get(IDENTITY_COOKIE)?.value
    const suffixIsValid =
      !!existingSuffix && /^[a-z0-9]{4}$/.test(existingSuffix)
    const suffix = suffixIsValid ? existingSuffix! : randomString(4)

    const identity = session
      ? `user_${session.user.id}`
      : `${participantName}__${suffix}`

    // Organiser authority: the signed-in owner, or a guest presenting the
    // Creator Token for this Meeting (ADR 0016). Advertised in the token
    // metadata for the room UI; every privileged endpoint re-checks it
    // server-side, so this flag is never load-bearing on its own.
    const isOrganiser = session
      ? meeting.organiserId === session.user.id
      : verifyCreatorToken(body.creatorToken, meeting.creatorTokenHash)

    const tokenOptions: AccessTokenOptions = {
      identity,
      name: participantName,
      ttl: TOKEN_TTL,
      metadata: JSON.stringify({ organiser: isOrganiser }),
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
    if (!session && !suffixIsValid) {
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
