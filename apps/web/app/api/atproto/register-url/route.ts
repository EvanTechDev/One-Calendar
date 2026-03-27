import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  return NextResponse.redirect(new URL("/", request.url));
}

/*
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ATPROTO_DISABLED, atprotoDisabledResponse } from "@/lib/atproto-feature";
import { createPkcePair } from "@/lib/atproto";
import { setAtprotoOAuthTxnCookie } from "@/lib/atproto-oauth-txn";
import { generateDpopKeyMaterial } from "@/lib/dpop";

const ROSE_PDS_ORIGIN = "https://rose.madebydanny.uk";

function getBaseUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (ATPROTO_DISABLED) return atprotoDisabledResponse();
  const baseUrl = getBaseUrl(request);
  const clientId = `${baseUrl}/oauth-client-metadata.json`;
  const authorizeUrl = new URL(`${ROSE_PDS_ORIGIN}/oauth/authorize`);

  const { verifier, challenge } = createPkcePair();
  const state = randomUUID();
  const dpop = generateDpopKeyMaterial();
  const redirectUri = `${baseUrl}/api/atproto/callback`;

  const parRes = await fetch(`${ROSE_PDS_ORIGIN}/oauth/par`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "atproto transition:generic",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      dpop_jkt: dpop.jkt,
    }),
    cache: "no-store",
  });

  if (!parRes.ok) {
    const detail = (await parRes.text()).slice(0, 200) || "par_failed";
    return NextResponse.json({ error: `Rose PAR failed: ${detail}` }, { status: 502 });
  }

  const parJson = (await parRes.json()) as { request_uri?: string };
  if (!parJson.request_uri) {
    return NextResponse.json({ error: "Rose PAR response missing request_uri" }, { status: 502 });
  }

  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("request_uri", parJson.request_uri);

  const response = NextResponse.json({ authorizeUrl: authorizeUrl.toString() });
  const secure = request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production";
  setAtprotoOAuthTxnCookie(
    response,
    {
      jti: randomUUID(),
      state,
      verifier,
      handle: "",
      pds: ROSE_PDS_ORIGIN,
      did: "",
      dpopPrivateKeyPem: dpop.privateKeyPem,
      dpopPublicJwk: dpop.publicJwk,
      issuedAt: Math.floor(Date.now() / 1000),
    },
    secure,
  );

  return response;
}

*/
