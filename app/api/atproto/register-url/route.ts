import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createPkcePair } from "@/lib/atproto";

const ROSE_PDS_ORIGIN = "https://rose.madebydanny.uk";

function getBaseUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const baseUrl = getBaseUrl(request);
  const clientId = process.env.ATPROTO_CLIENT_ID || `${baseUrl}/oauth-client-metadata.json`;
  const authorizeUrl = new URL(`${ROSE_PDS_ORIGIN}/oauth/authorize`);

  const { challenge } = createPkcePair();
  const redirectUri = `${baseUrl}/at-oauth`;

  try {
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
        state: randomUUID(),
        code_challenge: challenge,
        code_challenge_method: "S256",
      }),
      cache: "no-store",
    });

    if (parRes.ok) {
      const parJson = (await parRes.json()) as { request_uri?: string };
      if (parJson.request_uri) {
        authorizeUrl.searchParams.set("client_id", clientId);
        authorizeUrl.searchParams.set("request_uri", parJson.request_uri);
        return NextResponse.json({ authorizeUrl: authorizeUrl.toString() });
      }
    }
  } catch {
    // Graceful fallback to client_id-only URL when PAR is unavailable.
  }

  authorizeUrl.searchParams.set("client_id", clientId);
  return NextResponse.json({ authorizeUrl: authorizeUrl.toString() });
}
