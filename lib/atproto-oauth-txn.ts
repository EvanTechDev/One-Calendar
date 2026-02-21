import { createHash } from "node:crypto";
import type { DpopPublicJwk } from "@/lib/dpop";
import type { NextRequest, NextResponse } from "next/server";
import { getKeyEntries, sealJsonPayload, unsealJsonPayload } from "@/lib/atproto-auth";

export const ATPROTO_OAUTH_TXN_COOKIE = "atproto_oauth_txn";
const OAUTH_TXN_MAX_AGE_SECONDS = 600;

export interface AtprotoOAuthTxn {
  jti: string;
  state: string;
  verifier: string;
  handle: string;
  pds: string;
  did: string;
  dpopPrivateKeyPem: string;
  dpopPublicJwk: DpopPublicJwk;
  issuedAt: number;
}

const consumedTxnCache = new Map<string, number>();

function cleanupConsumed(now: number) {
  for (const [key, exp] of consumedTxnCache.entries()) {
    if (exp <= now) consumedTxnCache.delete(key);
  }
}

function txnCacheKey(jti: string) {
  return createHash("sha256").update(jti, "utf8").digest("hex");
}

export function setAtprotoOAuthTxnCookie(response: NextResponse, txn: AtprotoOAuthTxn, secure: boolean) {
  const keys = getKeyEntries();
  const activeKey = keys[0];
  if (!activeKey) {
    throw new Error("Missing ATProto cookie key for OAuth transaction protection");
  }

  const value = sealJsonPayload(txn, activeKey);
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

  const txn = unsealJsonPayload<AtprotoOAuthTxn>(raw);
  if (!txn) return null;

  const now = Math.floor(Date.now() / 1000);
  if (!txn.issuedAt || now - txn.issuedAt > OAUTH_TXN_MAX_AGE_SECONDS) {
    return null;
  }

  return txn;
}

export function consumeAtprotoOAuthTxn(txn: AtprotoOAuthTxn) {
  const now = Math.floor(Date.now() / 1000);
  cleanupConsumed(now);

  const key = txnCacheKey(txn.jti);
  if (consumedTxnCache.has(key)) {
    return false;
  }

  consumedTxnCache.set(key, now + OAUTH_TXN_MAX_AGE_SECONDS);
  return true;
}

export function clearAtprotoOAuthTxnCookie(response: NextResponse) {
  response.cookies.delete(ATPROTO_OAUTH_TXN_COOKIE);
}
