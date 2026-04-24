import { createHash } from 'node:crypto'
import { and, eq, gt, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import type { OAuthClientMetadata } from '@one-calendar/types'
import { db } from '@/lib/db'
import { authorizationCodes, grants } from '@/lib/schema'
import { randomToken } from '@/lib/oauth'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

async function validateAuthorizeParams(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const clientId = q.get('client_id') ?? ''
  const redirectUri = q.get('redirect_uri') ?? ''
  const codeChallenge = q.get('code_challenge') ?? ''
  const codeChallengeMethod = q.get('code_challenge_method') ?? ''
  const state = q.get('state') ?? ''
  const scope = q.get('scope') ?? 'calendar:read calendar:write'

  if (!clientId || !redirectUri || !codeChallenge || !state) {
    throw new Error('missing_oauth_parameters')
  }
  if (codeChallengeMethod !== 'S256') {
    throw new Error('pkce_method_must_be_s256')
  }

  const metadataRes = await fetch(clientId, { cache: 'no-store' })
  if (!metadataRes.ok) {
    throw new Error('client_metadata_fetch_failed')
  }

  const metadata = (await metadataRes.json()) as OAuthClientMetadata
  const allowed = Array.isArray(metadata.redirect_uris)
    ? metadata.redirect_uris
    : []

  if (!allowed.includes(redirectUri)) {
    throw new Error('invalid_redirect_uri')
  }

  return { clientId, redirectUri, codeChallenge, state, scope }
}

export async function GET(req: NextRequest) {
  try {
    const parsed = await validateAuthorizeParams(req)
    const safeClientId = escapeHtml(parsed.clientId)
    const safeRedirectUri = escapeHtml(parsed.redirectUri)
    const safeCodeChallenge = escapeHtml(parsed.codeChallenge)
    const safeState = escapeHtml(parsed.state)
    const safeScope = escapeHtml(parsed.scope)

    const html = `<!doctype html><html><body><main style="max-width:520px;margin:48px auto;font-family:Arial"><h1>Authorize One Calendar</h1><p>Client: ${safeClientId}</p><form method="post"><input type="hidden" name="client_id" value="${safeClientId}" /><input type="hidden" name="redirect_uri" value="${safeRedirectUri}" /><input type="hidden" name="code_challenge" value="${safeCodeChallenge}" /><input type="hidden" name="code_challenge_method" value="S256" /><input type="hidden" name="state" value="${safeState}" /><input type="hidden" name="scope" value="${safeScope}" /><label>DID <input required minlength="5" name="did" placeholder="did:plc:xxxx" style="width:100%" /></label><button type="submit" style="margin-top:16px">authorize</button></form></main></body></html>`

    return new NextResponse(html, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'invalid_request', message: (error as Error).message },
      { status: 400 },
    )
  }
}

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const did = String(form.get('did') ?? '').trim()
  const state = String(form.get('state') ?? '')
  const clientId = String(form.get('client_id') ?? '')
  const redirectUri = String(form.get('redirect_uri') ?? '')
  const codeChallenge = String(form.get('code_challenge') ?? '')
  const codeChallengeMethod = String(form.get('code_challenge_method') ?? '')
  const scope = String(form.get('scope') ?? 'calendar:read calendar:write')

  if (!did.startsWith('did:')) {
    return NextResponse.json({ error: 'invalid_did' }, { status: 400 })
  }

  if (codeChallengeMethod !== 'S256') {
    return NextResponse.json({ error: 'pkce_method_must_be_s256' }, { status: 400 })
  }

  const now = Date.now()
  const countRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(authorizationCodes)
    .where(
      and(
        eq(authorizationCodes.clientId, clientId),
        gt(authorizationCodes.expiresAt, new Date(now)),
      ),
    )

  const activeCodeCount = Number(countRow[0]?.count ?? 0)
  if (activeCodeCount > 1000) {
    return NextResponse.json({ error: 'server_overloaded' }, { status: 429 })
  }

  await db.insert(grants).values({
    id: createHash('sha256').update(`${did}:${clientId}`).digest('hex'),
    did,
    clientId,
    scopes: scope,
    createdAt: new Date(now),
  })

  const code = randomToken(32)
  await db.insert(authorizationCodes).values({
    code,
    did,
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    scope,
    createdAt: new Date(now),
    expiresAt: new Date(now + 5 * 60 * 1000),
  })

  const redirect = new URL(redirectUri)
  redirect.searchParams.set('code', code)
  redirect.searchParams.set('state', state)
  return NextResponse.redirect(redirect)
}
