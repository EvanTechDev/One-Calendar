import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  return NextResponse.redirect(new URL("/", request.url));
}

/*
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ATPROTO_DISABLED, atprotoDisabledResponse } from "@/lib/atproto-feature";
import { createPkcePair, resolveHandle } from "@/lib/atproto";
import { generateDpopKeyMaterial } from "@/lib/dpop";
import { setAtprotoOAuthTxnCookie } from "@/lib/atproto-oauth-txn";

const LOGIN_RATE_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_RATE_LIMIT = 20;
const loginRateCache = new Map<string, { count: number; resetAt: number }>();

function getExpectedBaseUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
}

function isAllowedOrigin(request: NextRequest, expectedBaseUrl: string) {
  const expected = new URL(expectedBaseUrl);
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.origin !== expected.origin) return false;
    } catch {
      return false;
    }
  }

  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").toLowerCase();
  if (host && host !== expected.host.toLowerCase()) {
    return false;
  }

  return true;
}

function checkRateLimit(request: NextRequest, handle: string) {
  const now = Date.now();
  for (const [key, value] of loginRateCache.entries()) {
    if (value.resetAt <= now) loginRateCache.delete(key);
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = `${ip}:${handle}`;
  const record = loginRateCache.get(key);

  if (!record || record.resetAt <= now) {
    loginRateCache.set(key, { count: 1, resetAt: now + LOGIN_RATE_WINDOW_MS });
    return true;
  }

  if (record.count >= LOGIN_RATE_LIMIT) {
    return false;
  }

  record.count += 1;
  loginRateCache.set(key, record);
  return true;
}

export async function POST(request: NextRequest) {
  if (ATPROTO_DISABLED) return atprotoDisabledResponse();
  const expectedBaseUrl = getExpectedBaseUrl(request);
  if (!isAllowedOrigin(request, expectedBaseUrl)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { handle } = (await request.json()) as { handle?: string };
  if (!handle) return NextResponse.json({ error: "Missing handle" }, { status: 400 });

  const normalizedHandle = handle.replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9.-]{3,253}$/.test(normalizedHandle)) {
    return NextResponse.json({ error: "Invalid handle" }, { status: 400 });
  }

  if (!checkRateLimit(request, normalizedHandle)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { did, pds } = await resolveHandle(normalizedHandle);
  const { verifier, challenge } = createPkcePair();
  const state = randomUUID();
  const dpop = generateDpopKeyMaterial();

  const redirectUri = `${expectedBaseUrl}/api/atproto/callback`;
  const clientId = `${expectedBaseUrl}/oauth-client-metadata.json`;

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
      jti: randomUUID(),
      state,
      verifier,
      handle: normalizedHandle,
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

*/
