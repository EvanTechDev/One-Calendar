import { NextRequest, NextResponse } from "next/server";
import { createPkcePair, resolveHandle } from "@/lib/atproto";

export async function POST(request: NextRequest) {
  const { handle } = (await request.json()) as { handle?: string };
  if (!handle) return NextResponse.json({ error: "Missing handle" }, { status: 400 });

  const { did, pds } = await resolveHandle(handle);
  const { verifier, challenge } = createPkcePair();
  const state = crypto.randomUUID();

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

  const response = NextResponse.json({ authorizeUrl: authUrl.toString(), pds, did });
  const secure = request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production";
  const cookieOptions = { httpOnly: true, secure, path: "/", sameSite: "lax" as const, maxAge: 600 };
  response.cookies.set("atproto_oauth_state", state, cookieOptions);
  response.cookies.set("atproto_oauth_verifier", verifier, cookieOptions);
  response.cookies.set("atproto_oauth_handle", handle.replace(/^@/, "").toLowerCase(), cookieOptions);
  response.cookies.set("atproto_oauth_pds", pds, cookieOptions);
  response.cookies.set("atproto_oauth_did", did, cookieOptions);

  return response;
}
