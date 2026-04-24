import { NextRequest, NextResponse } from 'next/server'
import { createPkcePair, persistTxn, randomState } from '@/lib/ds/oauth-txn'
import { resolveDsForHandle } from '@/lib/ds-discovery'

export async function POST(req: NextRequest) {
  const { ds, handle } = (await req.json().catch(() => ({}))) as {
    ds?: string
    handle?: string
  }

  const state = randomState()
  const { verifier, challenge } = createPkcePair()
  const base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') ?? req.nextUrl.origin
  const clientId = `${base}/oauth-client-metadata.json`
  const redirectUri = `${base}/api/ds/oauth/callback`

  let dsIssuer = ds?.replace(/\/$/, '')
  let normalizedHandle = handle?.replace(/^@/, '').trim().toLowerCase()

  if (!dsIssuer) {
    if (!normalizedHandle) {
      return NextResponse.json({ error: 'missing_handle_or_ds' }, { status: 400 })
    }

    try {
      const discovered = await resolveDsForHandle(normalizedHandle)
      dsIssuer = discovered.dsUrl
      normalizedHandle = discovered.handle
    } catch (error) {
      return NextResponse.json(
        { error: 'ds_discovery_failed', message: (error as Error).message },
        { status: 400 },
      )
    }
  }

  await persistTxn({
    state,
    codeVerifier: verifier,
    dsIssuer,
    createdAt: Date.now(),
  })

  const authUrl = new URL(`${dsIssuer}/atproto/auth`)
  authUrl.searchParams.set('source', 'web')
  if (normalizedHandle) authUrl.searchParams.set('handle', normalizedHandle)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('code_challenge', challenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('scope', 'calendar:read calendar:write')

  return NextResponse.json({ authorizeUrl: authUrl.toString(), dsIssuer })
}
