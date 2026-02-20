import { NextResponse } from "next/server"
import { getAtprotoOauthConfig } from "@/lib/atproto-oauth"

export const dynamic = "force-static"
export const revalidate = 60 * 60 * 24

export async function GET() {
  const oauthConfig = getAtprotoOauthConfig()
  if (!oauthConfig) {
    return NextResponse.json({ error: "Missing ATPROTO OAuth base URL" }, { status: 500 })
  }

  return NextResponse.json(
    {
      client_id: oauthConfig.clientId,
      client_name: "One Calendar",
      application_type: "web",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      redirect_uris: [oauthConfig.redirectUri],
      scope: "atproto",
      token_endpoint_auth_method: "none",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  )
}
