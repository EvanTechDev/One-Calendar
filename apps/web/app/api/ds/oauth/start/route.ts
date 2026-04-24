import { NextRequest, NextResponse } from 'next/server'
import { createPkcePair, persistTxn, randomState } from '@/lib/ds/oauth-txn'

export async function POST(req: NextRequest) {
  const { ds } = (await req.json().catch(() => ({}))) as { ds?: string }
  if (!ds) return NextResponse.json({ error: 'missing_ds' }, { status: 400 })

  const dsIssuer = ds.replace(/\/$/, '')
  const state = randomState()
  const { verifier, challenge } = createPkcePair()

  const base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') ?? req.nextUrl.origin
  const clientId = `${base}/oauth-client-metadata.json`
  const redirectUri = `${base}/api/ds/oauth/callback`

  await persistTxn({ state, codeVerifier: verifier, dsIssuer, createdAt: Date.now() })

  const authUrl = new URL(`${dsIssuer}/oauth/authorize`)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('code_challenge', challenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('scope', 'calendar:read calendar:write')

  return NextResponse.json({ authorizeUrl: authUrl.toString() })
}
