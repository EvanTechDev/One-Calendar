import { NextRequest } from "next/server";
import { assertTimestampWithinWindow, normalizeSignedPayload, verifyDidSignature } from "@onecalendar/crypto";
import type { DsSignedPayload } from "@onecalendar/types";

const didDocCache = new Map<string, { expiresAt: number; doc: { verificationMethod?: Array<{ publicKeyJwk?: JsonWebKey }> } }>();

async function resolveDidDocument(did: string) {
  const cached = didDocCache.get(did);
  if (cached && cached.expiresAt > Date.now()) return cached.doc;

  const res = await fetch(`https://plc.directory/${encodeURIComponent(did)}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("failed to resolve did doc");
  }

  const doc = (await res.json()) as { verificationMethod?: Array<{ publicKeyJwk?: JsonWebKey }> };
  didDocCache.set(did, { expiresAt: Date.now() + 10 * 60_000, doc });
  return doc;
}

export async function verifyRequest(request: NextRequest) {
  const did = request.headers.get("x-did") || "";
  const timestamp = request.headers.get("x-timestamp") || "";
  const signature = request.headers.get("x-signature") || "";

  if (!did || !timestamp || !signature) {
    throw new Error("missing signed headers");
  }

  if (!assertTimestampWithinWindow(timestamp)) {
    throw new Error("timestamp out of range");
  }

  const rawBody = await request.text();
  const payload: DsSignedPayload = {
    method: request.method,
    path: request.nextUrl.pathname,
    timestamp,
    body: rawBody,
  };

  const ok = await verifyDidSignature({ did, signature, payload, resolveDidDocument });
  if (!ok) {
    throw new Error("invalid signature");
  }

  return {
    did,
    body: rawBody,
    parsed: rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {},
    normalizedPayload: normalizeSignedPayload(payload),
  };
}
