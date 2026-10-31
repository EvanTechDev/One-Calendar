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
    // Rate limiting on raw IP alone locked out shared-NAT offices: a 31-person
    // all-hands behind one address exhausted a 30-per-10-minutes budget before
    // everyone was in. The tight limit is therefore per (meeting, browser),
    // which is what actually bounds a runaway client, with a much looser IP
    // backstop that only catches genuine floods.
    //
    // The browser is identified by the same stable identity cookie used for the
    // participant identity below. A caller can clear it to get a fresh bucket —
    // which is exactly why the IP backstop is still here. This is a brake on
    // casual abuse, never a security boundary.
    const browserKey = request.cookies.get(IDENTITY_COOKIE)?.value ?? 'new'
    const address = clientAddress(request)
    const [perBrowser, perAddress] = await Promise.all([
      checkFixedWindowLimit({
        name: 'meeting-token',
        subject: `${roomName}:${browserKey}`,
        limit: 30,
        windowSeconds: 600,
      }),
      checkFixedWindowLimit({
        name: 'meeting-token-ip',
        subject: address,
        limit: 300,
        windowSeconds: 600,
      }),
    ])
    const limit = !perBrowser.allowed ? perBrowser : perAddress
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

    // Organiser authority: the signed-in owner, OR a guest presenting the
    // Creator Token for this Meeting (ADR 0016). Both are checked, never one
    // instead of the other — the previous `session ? … : …` denied authority to
    // someone who created a meeting as a guest and later signed in, even though
    // the privileged endpoints (which use isOrganiser) would accept them. The
    // UI then hid the End button on a meeting the API agreed they owned.
    //
    // Advertised in the token metadata for the room UI; every privileged
    // endpoint re-checks it server-side, so this flag is never load-bearing.
    const organiser =
      (session !== null && meeting.organiserId === session.user.id) ||
      verifyCreatorToken(body.creatorToken, meeting.creatorTokenHash)

    const tokenOptions: AccessTokenOptions = {
      identity,
      name: participantName,
      ttl: TOKEN_TTL,
      metadata: JSON.stringify({ organiser }),
    }
    const grant: VideoGrant = {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
      // Raising a hand writes a participant attribute, and the server rejects
      // `setAttributes` without this grant — "by default, a participant is not
      // allowed to update its own metadata". Without it the hand silently never
      // went up. Attributes are the durable half of lib/room-signals; the
      // transient half rides canPublishData.
      canUpdateOwnMetadata: true,
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
