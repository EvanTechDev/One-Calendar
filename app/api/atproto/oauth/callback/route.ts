import { NextRequest, NextResponse } from "next/server"
import { clearAtprotoOauthState, getAtprotoOauthState, setAtprotoSession } from "@/lib/atproto"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state")

  try {
    const oauth = await getAtprotoOauthState()
    if (!oauth || !code || !state || oauth.state !== state) {
      return NextResponse.redirect(new URL("/atproto?error=oauth_state", request.url))
    }

    const clientId = process.env.ATPROTO_OAUTH_CLIENT_ID
    const redirectUri = process.env.ATPROTO_OAUTH_REDIRECT_URI
    if (!clientId || !redirectUri) {
      return NextResponse.redirect(new URL("/atproto?error=oauth_config", request.url))
    }

    const tokenRes = await fetch(`${oauth.pds}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: oauth.verifier,
      }),
    })

    if (!tokenRes.ok) {
      return NextResponse.redirect(new URL("/atproto?error=oauth_token", request.url))
    }

    const token = await tokenRes.json() as {
      access_token: string
      refresh_token?: string
      sub?: string
    }

    const did = token.sub || ""
    if (!did) {
      return NextResponse.redirect(new URL("/atproto?error=oauth_sub", request.url))
    }

    const profileRes = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`)
    const profile = profileRes.ok ? await profileRes.json() as { handle?: string; displayName?: string; avatar?: string } : null

    await setAtprotoSession({
      did,
      handle: profile?.handle || oauth.handle,
      pds: oauth.pds,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      displayName: profile?.displayName,
      avatar: profile?.avatar,
    })
    await clearAtprotoOauthState()

    return NextResponse.redirect(new URL("/app", request.url))
  } catch {
    return NextResponse.redirect(new URL("/atproto?error=oauth_unknown", request.url))
  }
}
