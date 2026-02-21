import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createPkcePair, resolveHandle } from "@/lib/atproto";
import { generateDpopKeyMaterial } from "@/lib/dpop";
import { setAtprotoOAuthTxnCookie } from "@/lib/atproto-oauth-txn";

export async function POST(request: NextRequest) {
  const { handle } = (await request.json()) as { handle?: string };
  if (!handle) return NextResponse.json({ error: "Missing handle" }, { status: 400 });

  const { did, pds } = await resolveHandle(handle);
  const { verifier, challenge } = createPkcePair();
  const state = randomUUID();
  const dpop = generateDpopKeyMaterial();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/atproto/callback`;
  const clientId = process.env.ATPROTO_CLIENT_ID || `${baseUrl}/oauth-client-metadata.json`;

  const authUrl = new URL(`${pds.replace(/\/$/, "")}/oauth/authorize`);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "atproto transition:generic");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("dpop_jkt", dpop.jkt);

  const response = NextResponse.json({ authorizeUrl: authUrl.toString(), pds, did });
  const secure = request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production";
  setAtprotoOAuthTxnCookie(
    response,
    {
      state,
      verifier,
      handle: handle.replace(/^@/, "").toLowerCase(),
      pds,
      did,
      dpopPrivateKeyPem: dpop.privateKeyPem,
      dpopPublicJwk: dpop.publicJwk,
      issuedAt: Math.floor(Date.now() / 1000),
    },
    secure,
  );

  ["__session", "__client_uat", "__clerk_db_jwt", "__clerk_handshake"].forEach((key) => {
    response.cookies.delete(key);
  });

  return response;
}
