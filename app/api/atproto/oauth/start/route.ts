import { NextRequest, NextResponse } from "next/server"
import { createAtprotoStateToken, createPkce, resolveAtprotoHandle, setAtprotoOauthState } from "@/lib/atproto"
import { getAtprotoOauthConfig } from "@/lib/atproto-oauth"

export async function POST(request: NextRequest) {
  try {
    const { handle } = (await request.json()) as { handle?: string }
    if (!handle) return NextResponse.json({ error: "Handle is required" }, { status: 400 })

    const normalized = handle.replace(/^@/, "").trim().toLowerCase()
    const { pds } = await resolveAtprotoHandle(normalized)
    const { verifier, challenge, state } = createPkce()
    const stateToken = createAtprotoStateToken(verifier)
    await setAtprotoOauthState({ handle: normalized, pds, verifier, state })

    const oauthConfig = getAtprotoOauthConfig(request.url)
    if (!oauthConfig) {
      return NextResponse.json({ error: "Missing ATPROTO OAuth base URL. Set ATPROTO_OAUTH_BASE_URL or NEXT_PUBLIC_BASE_URL." }, { status: 500 })
    }

    const { clientId, redirectUri } = oauthConfig

    const authUrl = `${pds}/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent("atproto")}&state=${encodeURIComponent(stateToken)}&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256`

    return NextResponse.json({ authUrl, pds, handle: normalized })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to start OAuth" }, { status: 500 })
  }
}
