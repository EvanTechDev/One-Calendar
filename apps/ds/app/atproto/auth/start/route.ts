import { NextRequest, NextResponse } from 'next/server'
import { createPkcePair, randomState, setTxn } from '@/lib/atproto-auth-txn'
import { resolveHandleToDidAndPds } from '@/lib/atproto'

function toStringOrEmpty(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value : ''
}

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const handle = toStringOrEmpty(form.get('handle')).trim()
  const source = toStringOrEmpty(form.get('source')) === 'web' ? 'web' : 'local'

  try {
    const resolved = await resolveHandleToDidAndPds(handle)
    const { codeVerifier, codeChallenge } = createPkcePair()
    const state = randomState()

    const base = process.env.DS_ISSUER_URL?.trim() ?? req.nextUrl.origin
    const clientId = process.env.DS_ATPROTO_CLIENT_ID?.trim() || `${base}/atproto/client-metadata.json`
    const redirectUri = process.env.DS_ATPROTO_REDIRECT_URI?.trim() || `${base}/atproto/auth/callback`

    await setTxn({
      state,
      codeVerifier,
      handle: resolved.handle,
      did: resolved.did,
      pds: resolved.pds,
      source,
      webOauth:
        source === 'web'
          ? {
              clientId: toStringOrEmpty(form.get('client_id')),
              redirectUri: toStringOrEmpty(form.get('redirect_uri')),
              codeChallenge: toStringOrEmpty(form.get('code_challenge')),
              state: toStringOrEmpty(form.get('state')),
              scope:
                toStringOrEmpty(form.get('scope')) || 'calendar:read calendar:write',
            }
          : undefined,
    })

    const authorize = new URL(`${resolved.pds.replace(/\/$/, '')}/oauth/authorize`)
    authorize.searchParams.set('client_id', clientId)
    authorize.searchParams.set('redirect_uri', redirectUri)
    authorize.searchParams.set('response_type', 'code')
    authorize.searchParams.set('scope', 'atproto transition:generic')
    authorize.searchParams.set('code_challenge', codeChallenge)
    authorize.searchParams.set('code_challenge_method', 'S256')
    authorize.searchParams.set('state', state)

    return NextResponse.redirect(authorize)
  } catch (error) {
    const retry = new URL('/atproto/auth', req.nextUrl.origin)
    retry.searchParams.set('source', source)
    retry.searchParams.set('handle', handle)
    retry.searchParams.set('error', (error as Error).message)
    return NextResponse.redirect(retry)
  }
}
