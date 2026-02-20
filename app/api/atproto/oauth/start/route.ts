import { NextRequest, NextResponse } from "next/server"
import { createAtprotoStateToken, createPkce, discoverAtprotoOauthEndpoints, resolveAtprotoHandle, setAtprotoOauthState } from "@/lib/atproto"
import { getAtprotoOauthConfig } from "@/lib/atproto-oauth"

export async function POST(request: NextRequest) {
  try {
    const { handle } = (await request.json()) as { handle?: string }
    if (!handle) return NextResponse.json({ error: "Handle is required" }, { status: 400 })

    const normalized = handle.replace(/^@/, "").trim().toLowerCase()
    const { pds } = await resolveAtprotoHandle(normalized)
    const endpoints = await discoverAtprotoOauthEndpoints(pds)
    const { verifier, challenge } = createPkce()
    const stateToken = createAtprotoStateToken(verifier)
    await setAtprotoOauthState({
      handle: normalized,
      pds,
      verifier,
      state: stateToken,
      issuer: endpoints.issuer,
      authorizationEndpoint: endpoints.authorizationEndpoint,
      tokenEndpoint: endpoints.tokenEndpoint,
      parEndpoint: endpoints.parEndpoint,
    })

    const oauthConfig = getAtprotoOauthConfig(request.url)
    if (!oauthConfig) {
      return NextResponse.json({ error: "Missing ATPROTO OAuth base URL. Set ATPROTO_OAUTH_BASE_URL or NEXT_PUBLIC_BASE_URL." }, { status: 500 })
    }

    const { clientId, redirectUri } = oauthConfig

    const parRes = endpoints.parEndpoint ? await fetch(endpoints.parEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "atproto",
        state: stateToken,
        login_hint: normalized,
        code_challenge: challenge,
        code_challenge_method: "S256",
      }),
    }) : null

    let authUrl: string

    if (parRes?.ok) {
      const payload = await parRes.json() as { request_uri?: string }
      if (!payload.request_uri) {
        return NextResponse.json({ error: "PDS did not return request_uri" }, { status: 502 })
      }
      authUrl = `${endpoints.authorizationEndpoint}?client_id=${encodeURIComponent(clientId)}&request_uri=${encodeURIComponent(payload.request_uri)}`
    } else {
      authUrl = `${endpoints.authorizationEndpoint}?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent("atproto")}&state=${encodeURIComponent(stateToken)}&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256&login_hint=${encodeURIComponent(normalized)}`
    }

    return NextResponse.json({ authUrl, pds, handle: normalized })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to start OAuth" }, { status: 500 })
  }
}
