import { NextRequest, NextResponse } from "next/server";
import { getActorProfileRecord, getProfile, profileAvatarBlobUrl } from "@/lib/atproto";
import { setAtprotoSession } from "@/lib/atproto-auth";
import { clearAtprotoOAuthTxnCookie, consumeAtprotoOAuthTxn, getAtprotoOAuthTxnFromRequest } from "@/lib/atproto-oauth-txn";
import { createDpopProof, type DpopPublicJwk } from "@/lib/dpop";

function parseJsonSafe<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function redirectWithError(baseUrl: string, error: string, reason?: string) {
  const url = new URL(`${baseUrl}/at-oauth`);
  url.searchParams.set("error", error);
  if (reason) {
    url.searchParams.set("reason", reason);
  }

  const response = NextResponse.redirect(url.toString());
  clearAtprotoOAuthTxnCookie(response);
  return response;
}

function normalizeIssuerOrigin(value: string) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") {
    throw new Error("Issuer must use https");
  }
  return parsed.origin;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const iss = request.nextUrl.searchParams.get("iss");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const txn = getAtprotoOAuthTxnFromRequest(request);

  if (!code || !state || !txn || state !== txn.state) {
    return redirectWithError(baseUrl, "oauth_state_mismatch");
  }

  if (!consumeAtprotoOAuthTxn(txn)) {
    return redirectWithError(baseUrl, "oauth_state_mismatch", "transaction_already_used");
  }

  const { verifier, handle, pds, did, dpopPrivateKeyPem, dpopPublicJwk } = txn;

  if (!dpopPublicJwk?.kty || !dpopPublicJwk?.crv || !dpopPublicJwk?.x || !dpopPublicJwk?.y) {
    return redirectWithError(baseUrl, "invalid_dpop_key");
  }

  let issuerOrigin: string;
  let pdsOrigin: string;
  try {
    pdsOrigin = normalizeIssuerOrigin(pds);
    issuerOrigin = iss ? normalizeIssuerOrigin(iss) : pdsOrigin;
  } catch {
    return redirectWithError(baseUrl, "invalid_issuer");
  }

  if (issuerOrigin !== pdsOrigin) {
    return redirectWithError(baseUrl, "invalid_issuer", "issuer_mismatch");
  }

  const clientId = process.env.ATPROTO_CLIENT_ID || `${baseUrl}/oauth-client-metadata.json`;
  const redirectUri = `${baseUrl}/api/atproto/callback`;
  const tokenUrl = `${issuerOrigin}/oauth/token`;

  const makeTokenRequest = async (nonce?: string) => {
    const dpopProof = createDpopProof({
      htu: tokenUrl,
      htm: "POST",
      privateKeyPem: dpopPrivateKeyPem,
      publicJwk: dpopPublicJwk as DpopPublicJwk,
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
    return redirectWithError(baseUrl, "token_exchange_failed", reason);
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string; refresh_token?: string; sub?: string };
  if (!tokenData.access_token) {
    return redirectWithError(baseUrl, "missing_access_token");
  }

  const actorDid = tokenData.sub || did;
  if (!actorDid) {
    return redirectWithError(baseUrl, "missing_subject");
  }

  const profile = await getProfile(pds, actorDid, tokenData.access_token, {
    privateKeyPem: dpopPrivateKeyPem,
    publicJwk: dpopPublicJwk,
  });

  const actorProfile = await getActorProfileRecord({
    pds,
    repo: actorDid,
    accessToken: tokenData.access_token,
    dpopPrivateKeyPem,
    dpopPublicJwk,
  }).catch(() => undefined);

  const avatarCid = actorProfile?.avatar?.ref?.$link;
  const avatarUrl = profileAvatarBlobUrl({ pds, did: actorDid, cid: avatarCid }) || profile?.avatar;

  await setAtprotoSession({
    did: actorDid,
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
  clearAtprotoOAuthTxnCookie(response);

  ["__session", "__client_uat", "__clerk_db_jwt", "__clerk_handshake"].forEach((key) => {
    response.cookies.delete(key);
  });

  return response;
}
