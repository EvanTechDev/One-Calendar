import { NextRequest, NextResponse } from 'next/server'
import { clearTxn, getTxn } from '@/lib/atproto-auth-txn'

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get('state') ?? ''
  const code = req.nextUrl.searchParams.get('code') ?? ''

  const txn = await getTxn()
  if (!txn || txn.state !== state || !code) {
    return NextResponse.redirect(new URL('/atproto/auth?error=invalid_state_or_code', req.nextUrl.origin))
  }

  if (txn.source === 'web' && txn.webOauth) {
    const consent = new URL('/atproto/auth/consent', req.nextUrl.origin)
    consent.searchParams.set('handle', txn.handle)
    return NextResponse.redirect(consent)
  }

  await clearTxn()
  const dashboard = new URL('/dashboard', req.nextUrl.origin)
  dashboard.searchParams.set('handle', txn.handle)
  dashboard.searchParams.set('did', txn.did)
  return NextResponse.redirect(dashboard)
}
