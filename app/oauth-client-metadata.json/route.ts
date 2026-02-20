import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  return NextResponse.json({
    client_id: process.env.ATPROTO_CLIENT_ID || `${baseUrl}/oauth-client-metadata.json`,
    application_type: "web",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    redirect_uris: [`${baseUrl}/api/atproto/callback`],
    token_endpoint_auth_method: "none",
    scope: "atproto transition:generic",
    dpop_bound_access_tokens: false,
  });
}
