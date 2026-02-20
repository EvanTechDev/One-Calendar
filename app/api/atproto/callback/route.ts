import { NextRequest, NextResponse } from "next/server";
import { getProfile } from "@/lib/atproto";
import { setAtprotoSession } from "@/lib/atproto-auth";
import { createDpopProof, type DpopPublicJwk } from "@/lib/dpop";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  const expectedState = request.cookies.get("atproto_oauth_state")?.value;
  const verifier = request.cookies.get("atproto_oauth_verifier")?.value;
  const handle = request.cookies.get("atproto_oauth_handle")?.value;
  const pds = request.cookies.get("atproto_oauth_pds")?.value;
  const did = request.cookies.get("atproto_oauth_did")?.value;
  const dpopPrivateRaw = request.cookies.get("atproto_oauth_dpop_private")?.value;
  const dpopPublicRaw = request.cookies.get("atproto_oauth_dpop_public")?.value;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  if (!code || !state || !expectedState || state !== expectedState || !verifier || !pds || !did || !handle || !dpopPrivateRaw || !dpopPublicRaw) {
    return NextResponse.redirect(`${baseUrl}/atproto?error=oauth_state_mismatch`);
  }

  const dpopPrivateKeyPem = Buffer.from(dpopPrivateRaw, "base64url").toString("utf8");
  const dpopPublicJwk = JSON.parse(Buffer.from(dpopPublicRaw, "base64url").toString("utf8")) as DpopPublicJwk;

  const clientId = process.env.ATPROTO_CLIENT_ID || `${baseUrl}/oauth-client-metadata.json`;
  const redirectUri = `${baseUrl}/api/atproto/callback`;
  const tokenUrl = `${pds.replace(/\/$/, "")}/oauth/token`;
  const dpopProof = createDpopProof({
    htu: tokenUrl,
    htm: "POST",
    privateKeyPem: dpopPrivateKeyPem,
    publicJwk: dpopPublicJwk,
  });

  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      DPoP: dpopProof,
    },
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

  const profile = await getProfile(pds, did, tokenData.access_token, {
    privateKeyPem: dpopPrivateKeyPem,
    publicJwk: dpopPublicJwk,
  });

  await setAtprotoSession({
    did,
    handle: profile?.handle || handle,
    pds,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    displayName: profile?.displayName,
    avatar: profile?.avatar,
    dpopPrivateKeyPem,
    dpopPublicJwk,
  });

  const response = NextResponse.redirect(`${baseUrl}/app`);
  [
    "atproto_oauth_state",
    "atproto_oauth_verifier",
    "atproto_oauth_handle",
    "atproto_oauth_pds",
    "atproto_oauth_did",
    "atproto_oauth_dpop_private",
    "atproto_oauth_dpop_public",
  ].forEach((key) => {
    response.cookies.delete(key);
  });
  return response;
}
