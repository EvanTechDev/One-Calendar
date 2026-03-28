import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const baseUrl = request.nextUrl.origin.replace(/\/$/, "");
  return NextResponse.json(
    {
      client_id: `${baseUrl}/oauth-client-metadata.json`,
      application_type: "web",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      redirect_uris: [`${baseUrl}/api/atproto/callback`],
      token_endpoint_auth_method: "none",
      scope: "atproto transition:generic",
      dpop_bound_access_tokens: true,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
