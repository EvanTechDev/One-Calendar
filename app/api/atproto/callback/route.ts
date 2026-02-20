import { NextRequest, NextResponse } from "next/server";
import { getActorProfileRecord, getProfile, profileAvatarBlobUrl } from "@/lib/atproto";
import { setAtprotoSession } from "@/lib/atproto-auth";
import { createDpopProof, type DpopPublicJwk } from "@/lib/dpop";

function parseJsonSafe<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const iss = request.nextUrl.searchParams.get("iss");

  const expectedState = request.cookies.get("atproto_oauth_state")?.value;
  const verifier = request.cookies.get("atproto_oauth_verifier")?.value;
  const handle = request.cookies.get("atproto_oauth_handle")?.value;
  const pds = request.cookies.get("atproto_oauth_pds")?.value;
  const did = request.cookies.get("atproto_oauth_did")?.value;
  const dpopPrivateRaw = request.cookies.get("atproto_oauth_dpop_private")?.value;
  const dpopPublicRaw = request.cookies.get("atproto_oauth_dpop_public")?.value;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  if (!code || !state || !expectedState || state !== expectedState || !verifier || !pds || !did || !handle || !dpopPrivateRaw || !dpopPublicRaw) {
    return NextResponse.redirect(`${baseUrl}/at-oauth?error=oauth_state_mismatch`);
  }

  const dpopPrivateKeyPem = Buffer.from(dpopPrivateRaw, "base64url").toString("utf8");
  const dpopPublicJwk = parseJsonSafe<DpopPublicJwk>(Buffer.from(dpopPublicRaw, "base64url").toString("utf8"));
  if (!dpopPublicJwk?.kty || !dpopPublicJwk?.crv || !dpopPublicJwk?.x || !dpopPublicJwk?.y) {
    return NextResponse.redirect(`${baseUrl}/at-oauth?error=invalid_dpop_key`);
  }

  const clientId = process.env.ATPROTO_CLIENT_ID || `${baseUrl}/oauth-client-metadata.json`;
  const redirectUri = `${baseUrl}/api/atproto/callback`;
  const issuer = iss || pds;
  const tokenUrl = `${issuer.replace(/\/$/, "")}/oauth/token`;

  const makeTokenRequest = async (nonce?: string) => {
    const dpopProof = createDpopProof({
      htu: tokenUrl,
      htm: "POST",
      privateKeyPem: dpopPrivateKeyPem,
      publicJwk: dpopPublicJwk,
      nonce,
    });

    return fetch(tokenUrl, {
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
  };

  let tokenRes = await makeTokenRequest();
  if (!tokenRes.ok) {
    const nonce = tokenRes.headers.get("DPoP-Nonce") || tokenRes.headers.get("dpop-nonce");
    if (nonce) {
      tokenRes = await makeTokenRequest(nonce);
    }
  }

  if (!tokenRes.ok) {
    const detailText = await tokenRes.text();
    const detailJson = parseJsonSafe<{ error?: string; error_description?: string }>(detailText);
    const reason = detailJson?.error_description || detailJson?.error || detailText.slice(0, 160) || "token_exchange_failed";
    return NextResponse.redirect(`${baseUrl}/at-oauth?error=token_exchange_failed&reason=${encodeURIComponent(reason)}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string; refresh_token?: string };
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${baseUrl}/at-oauth?error=missing_access_token`);
  }

  const profile = await getProfile(pds, did, tokenData.access_token, {
    privateKeyPem: dpopPrivateKeyPem,
    publicJwk: dpopPublicJwk,
  });

  const actorProfile = await getActorProfileRecord({
    pds,
    repo: did,
    accessToken: tokenData.access_token,
    dpopPrivateKeyPem,
    dpopPublicJwk,
  }).catch(() => undefined);

  const avatarCid = actorProfile?.avatar?.ref?.$link;
  const avatarUrl = profileAvatarBlobUrl({ pds, did, cid: avatarCid }) || profile?.avatar;

  await setAtprotoSession({
    did,
    handle: profile?.handle || handle,
    pds,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    displayName: actorProfile?.displayName || profile?.displayName,
    avatar: avatarUrl,
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

  ["__session", "__client_uat", "__clerk_db_jwt", "__clerk_handshake"].forEach((key) => {
    response.cookies.delete(key);
  });

  return response;
}
