import { NextRequest, NextResponse } from "next/server"
import { getAtprotoOauthConfig } from "@/lib/atproto-oauth"

export async function GET(request: NextRequest) {
  const oauthConfig = getAtprotoOauthConfig(request.url)
  if (!oauthConfig) {
    return NextResponse.json({ error: "Missing ATPROTO OAuth base URL" }, { status: 500 })
  }

  return NextResponse.json({
    client_id: oauthConfig.clientId,
    client_name: "One Calendar",
    application_type: "web",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    redirect_uris: [oauthConfig.redirectUri],
    scope: "atproto",
    token_endpoint_auth_method: "none",
  })
}
