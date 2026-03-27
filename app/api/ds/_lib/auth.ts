import { createPublicKey, createVerify } from "node:crypto";
import { NextRequest } from "next/server";
import { buildSignedPayload } from "@/lib/ds/signature";

const DID_CACHE_TTL_MS = 10 * 60 * 1000;
const didCache = new Map<string, { expiresAt: number; publicKeyPem: string }>();

type DidDocument = {
  verificationMethod?: Array<{
    id?: string;
    type?: string;
    publicKeyJwk?: JsonWebKey;
  }>;
};

async function resolveDidPublicKeyPem(did: string) {
  const now = Date.now();
  const cached = didCache.get(did);
  if (cached && cached.expiresAt > now) {
    return cached.publicKeyPem;
  }

  const didDocRes = await fetch(`https://plc.directory/${encodeURIComponent(did)}`, { cache: "no-store" });
  if (!didDocRes.ok) {
    throw new Error("failed to resolve did document");
  }

  const didDoc = (await didDocRes.json()) as DidDocument;
  const method = didDoc.verificationMethod?.find((item) => item.publicKeyJwk?.kty);
  if (!method?.publicKeyJwk) {
    throw new Error("did verification key missing");
  }

  const pem = createPublicKey({ key: method.publicKeyJwk, format: "jwk" }).export({ format: "pem", type: "spki" }).toString();
  didCache.set(did, { publicKeyPem: pem, expiresAt: now + DID_CACHE_TTL_MS });
  return pem;
}

export async function verifyDidSignedRequest(request: NextRequest) {
  const did = request.headers.get("x-did")?.trim();
  const timestamp = request.headers.get("x-timestamp")?.trim();
  const signature = request.headers.get("x-signature")?.trim();

  if (!did || !timestamp || !signature) {
    throw new Error("missing did signature headers");
  }

  const requestMs = Date.parse(timestamp);
  const now = Date.now();
  if (!Number.isFinite(requestMs) || Math.abs(now - requestMs) > 5 * 60 * 1000) {
    throw new Error("timestamp expired");
  }

  const rawBody = await request.text();
  const path = request.nextUrl.pathname;

  const payload = buildSignedPayload({
    method: request.method,
    path,
    timestamp,
    body: rawBody,
  });

  const publicKey = await resolveDidPublicKeyPem(did);
  const verifier = createVerify("SHA256");
  verifier.update(payload);
  verifier.end();

  const verified = verifier.verify(publicKey, signature, "base64url");
  if (!verified) {
    throw new Error("invalid signature");
  }

  return {
    did,
    rawBody,
    json: rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {},
  };
}
