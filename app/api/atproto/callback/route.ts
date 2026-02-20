import { NextRequest, NextResponse } from "next/server";
import { getProfile } from "@/lib/atproto";
import { setAtprotoSession } from "@/lib/atproto-auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  const expectedState = request.cookies.get("atproto_oauth_state")?.value;
  const verifier = request.cookies.get("atproto_oauth_verifier")?.value;
  const handle = request.cookies.get("atproto_oauth_handle")?.value;
  const pds = request.cookies.get("atproto_oauth_pds")?.value;
  const did = request.cookies.get("atproto_oauth_did")?.value;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  if (!code || !state || !expectedState || state !== expectedState || !verifier || !pds || !did || !handle) {
    return NextResponse.redirect(`${baseUrl}/atproto?error=oauth_state_mismatch`);
  }

  const clientId = process.env.ATPROTO_CLIENT_ID || `${baseUrl}/oauth-client-metadata.json`;
  const redirectUri = `${baseUrl}/api/atproto/callback`;

  const tokenRes = await fetch(`${pds.replace(/\/$/, "")}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${baseUrl}/atproto?error=token_exchange_failed`);
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string; refresh_token?: string };
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${baseUrl}/atproto?error=missing_access_token`);
  }

  const profile = await getProfile(pds, did, tokenData.access_token);

  await setAtprotoSession({
    did,
    handle: profile?.handle || handle,
    pds,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    displayName: profile?.displayName,
    avatar: profile?.avatar,
  });

  const response = NextResponse.redirect(`${baseUrl}/app`);
  ["atproto_oauth_state", "atproto_oauth_verifier", "atproto_oauth_handle", "atproto_oauth_pds", "atproto_oauth_did"].forEach((key) => {
    response.cookies.delete(key);
  });
  return response;
}
