import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const base = process.env.DS_ISSUER_URL?.trim() ?? req.nextUrl.origin
  const clientId = process.env.DS_ATPROTO_CLIENT_ID?.trim() || `${base}/atproto/client-metadata.json`
  const redirectUri = process.env.DS_ATPROTO_REDIRECT_URI?.trim() || `${base}/atproto/auth/callback`

  return NextResponse.json({
    client_id: clientId,
    application_type: 'web',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    redirect_uris: [redirectUri],
    token_endpoint_auth_method: 'none',
    scope: 'atproto transition:generic',
  })
}
