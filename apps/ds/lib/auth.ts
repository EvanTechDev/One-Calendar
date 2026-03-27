import { createPublicKey, verify } from "crypto";
import type { NextRequest } from "next/server";

type DidDoc = {
  verificationMethod?: Array<{ id?: string; publicKeyMultibase?: string; publicKeyJwk?: JsonWebKey }>;
};

function decodeBodyToVerify(method: string, path: string, ts: string, body: string) {
  return `${method.toUpperCase()}\n${path}\n${ts}\n${body}`;
}

function b64urlToBuffer(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(normalized, "base64");
}

async function resolveDidDoc(did: string): Promise<DidDoc> {
  const res = await fetch(`https://plc.directory/${encodeURIComponent(did)}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("failed_to_resolve_did_document");
  }
  return (await res.json()) as DidDoc;
}

function verifyWithJwk(jwk: JsonWebKey, payload: string, signature: string) {
  const key = createPublicKey({ key: jwk, format: "jwk" });
  return verify("sha256", Buffer.from(payload, "utf8"), { key, dsaEncoding: "ieee-p1363" }, b64urlToBuffer(signature));
}

export async function verifyRequest(request: NextRequest) {
  const did = request.headers.get("X-DID") || "";
  const timestamp = request.headers.get("X-Timestamp") || "";
  const signature = request.headers.get("X-Signature") || "";
  if (!did || !timestamp || !signature) {
    throw new Error("missing_signature_headers");
  }
  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > 5 * 60_000) {
    throw new Error("invalid_timestamp");
  }
  const rawBody = ["GET", "DELETE"].includes(request.method) ? "" : await request.clone().text();
  const path = new URL(request.url).pathname;
  const payload = decodeBodyToVerify(request.method, path, timestamp, rawBody);

  const didDoc = await resolveDidDoc(did);
  const methods = didDoc.verificationMethod || [];
  const hasValid = methods.some((method) => method.publicKeyJwk && verifyWithJwk(method.publicKeyJwk, payload, signature));
  if (!hasValid) {
    throw new Error("signature_verification_failed");
  }
  return { did };
}
