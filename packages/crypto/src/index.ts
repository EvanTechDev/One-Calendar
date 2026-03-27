import { createPublicKey, createVerify } from "node:crypto";
import type { DsSignedPayload } from "@onecalendar/types";

export function normalizeSignedPayload(input: DsSignedPayload) {
  return JSON.stringify({
    method: input.method.toUpperCase(),
    path: input.path,
    timestamp: input.timestamp,
    body: input.body,
  });
}

export async function verifyDidSignature(params: {
  did: string;
  signature: string;
  payload: DsSignedPayload;
  resolveDidDocument: (did: string) => Promise<{ verificationMethod?: Array<{ publicKeyJwk?: JsonWebKey }> }>;
}) {
  const doc = await params.resolveDidDocument(params.did);
  const jwk = doc.verificationMethod?.find((m) => m.publicKeyJwk)?.publicKeyJwk;
  if (!jwk) return false;

  const publicKey = createPublicKey({ key: jwk, format: "jwk" }).export({ type: "spki", format: "pem" });
  const verifier = createVerify("SHA256");
  verifier.update(normalizeSignedPayload(params.payload));
  verifier.end();
  return verifier.verify(publicKey, params.signature, "base64url");
}

export function assertTimestampWithinWindow(timestamp: string, maxSkewMs = 5 * 60 * 1000) {
  const ts = Date.parse(timestamp);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(Date.now() - ts) <= maxSkewMs;
}
