import { NextRequest, NextResponse } from 'next/server'
import { clearTxn, readTxn } from '@/lib/ds/oauth-txn'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code') ?? ''
  const state = req.nextUrl.searchParams.get('state') ?? ''

  const txn = await readTxn()
  if (!txn || txn.state !== state) {
    return NextResponse.json({ error: 'invalid_state' }, { status: 400 })
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') ?? req.nextUrl.origin
  const tokenRes = await fetch(`${txn.dsIssuer}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: `${base}/oauth-client-metadata.json`,
      redirect_uri: `${base}/api/ds/oauth/callback`,
      code_verifier: txn.codeVerifier,
    }),
    cache: 'no-store',
  })

  await clearTxn()

  if (!tokenRes.ok) {
    return NextResponse.json({ error: 'token_exchange_failed' }, { status: 400 })
  }

  const tokens = await tokenRes.json()
  return NextResponse.json({ success: true, tokens })
}
