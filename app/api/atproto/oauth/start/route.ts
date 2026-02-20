import { NextRequest, NextResponse } from "next/server"
import { createPkce, resolveAtprotoHandle, setAtprotoOauthState } from "@/lib/atproto"

export async function POST(request: NextRequest) {
  try {
    const { handle } = (await request.json()) as { handle?: string }
    if (!handle) return NextResponse.json({ error: "Handle is required" }, { status: 400 })

    const normalized = handle.replace(/^@/, "").trim().toLowerCase()
    const { pds } = await resolveAtprotoHandle(normalized)
    const { verifier, challenge, state } = createPkce()
    await setAtprotoOauthState({ handle: normalized, pds, verifier, state })

    const origin = request.nextUrl.origin
    const redirectUri = process.env.ATPROTO_OAUTH_REDIRECT_URI || `${origin}/api/atproto/oauth/callback`
    const clientId = process.env.ATPROTO_OAUTH_CLIENT_ID || process.env.NEXT_PUBLIC_BASE_URL || origin

    const authUrl = `${pds}/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent("atproto")}&state=${encodeURIComponent(state)}&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256`

    return NextResponse.json({ authUrl, pds, handle: normalized })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to start OAuth" }, { status: 500 })
  }
}
