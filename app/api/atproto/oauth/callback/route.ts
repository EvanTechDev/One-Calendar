import { NextRequest, NextResponse } from "next/server"
import { clearAtprotoOauthState, getAtprotoOauthState, parseAtprotoStateToken, setAtprotoSession } from "@/lib/atproto"
import { getAtprotoOauthConfig } from "@/lib/atproto-oauth"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state")
  const issuer = request.nextUrl.searchParams.get("iss")
  const providerError = request.nextUrl.searchParams.get("error")
  const providerErrorDescription = request.nextUrl.searchParams.get("error_description")

  try {
    if (providerError) {
      await clearAtprotoOauthState()
      const redirectUrl = new URL("/atproto", request.url)
      redirectUrl.searchParams.set("error", `oauth_provider_${providerError}`)
      if (providerErrorDescription) {
        redirectUrl.searchParams.set("error_description", providerErrorDescription)
      }
      return NextResponse.redirect(redirectUrl)
    }

    const oauthFromState = state ? parseAtprotoStateToken(state) : null
    const oauthFromCookie = await getAtprotoOauthState()

    const normalizedIssuer = issuer?.replace(/\/$/, "")

    const oauth = oauthFromState
      ? {
          handle: oauthFromCookie?.handle || "",
          pds: oauthFromCookie?.pds || "",
          verifier: oauthFromState.verifier,
          tokenEndpoint: oauthFromCookie?.tokenEndpoint || `${normalizedIssuer || oauthFromCookie?.pds || ""}/oauth/token`,
        }
      : (oauthFromCookie && (!state || oauthFromCookie.state === state)
          ? {
              handle: oauthFromCookie.handle,
              pds: oauthFromCookie.pds,
              verifier: oauthFromCookie.verifier,
              tokenEndpoint: oauthFromCookie.tokenEndpoint || `${oauthFromCookie.pds}/oauth/token`,
            }
          : null)

    if (!oauth || !oauth.pds || !oauth.tokenEndpoint || !code) {
      return NextResponse.redirect(new URL("/atproto?error=oauth_state", request.url))
    }

    const oauthConfig = getAtprotoOauthConfig(request.url)
    if (!oauthConfig) {
      return NextResponse.redirect(new URL("/atproto?error=oauth_config", request.url))
    }

    const { clientId, redirectUri } = oauthConfig

    const tokenRes = await fetch(oauth.tokenEndpoint, {
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
