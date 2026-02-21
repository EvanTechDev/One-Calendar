import type { DpopPublicJwk } from "@/lib/dpop";
import type { NextRequest, NextResponse } from "next/server";
import { getAtprotoCookieSecret, sealJsonPayload, unsealJsonPayload } from "@/lib/atproto-auth";

export const ATPROTO_OAUTH_TXN_COOKIE = "atproto_oauth_txn";
const OAUTH_TXN_MAX_AGE_SECONDS = 600;

export interface AtprotoOAuthTxn {
  state: string;
  verifier: string;
  handle: string;
  pds: string;
  did: string;
  dpopPrivateKeyPem: string;
  dpopPublicJwk: DpopPublicJwk;
  issuedAt: number;
}

export function setAtprotoOAuthTxnCookie(response: NextResponse, txn: AtprotoOAuthTxn, secure: boolean) {
  const secret = getAtprotoCookieSecret();
  if (!secret) {
    throw new Error("Missing ATPROTO_SESSION_SECRET (or NEXTAUTH_SECRET) for OAuth transaction protection");
  }

  const value = sealJsonPayload(txn, secret);
  response.cookies.set(ATPROTO_OAUTH_TXN_COOKIE, value, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_TXN_MAX_AGE_SECONDS,
  });
}

export function getAtprotoOAuthTxnFromRequest(request: NextRequest) {
  const raw = request.cookies.get(ATPROTO_OAUTH_TXN_COOKIE)?.value;
  if (!raw) return null;

  const secret = getAtprotoCookieSecret();
  if (!secret) return null;

  const txn = unsealJsonPayload<AtprotoOAuthTxn>(raw, secret);
  if (!txn) return null;

  const now = Math.floor(Date.now() / 1000);
  if (!txn.issuedAt || now - txn.issuedAt > OAUTH_TXN_MAX_AGE_SECONDS) {
    return null;
  }

  return txn;
}

export function clearAtprotoOAuthTxnCookie(response: NextResponse) {
  response.cookies.delete(ATPROTO_OAUTH_TXN_COOKIE);
}
