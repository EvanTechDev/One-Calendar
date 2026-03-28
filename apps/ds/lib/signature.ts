import { verify } from "@noble/ed25519";
import { base58 } from "@scure/base";
import { createHash, createPublicKey, verify as verifyNode } from "node:crypto";

const MAX_SKEW_MS = 5 * 60 * 1000;

type PlcDocument = {
  verificationMethod?: Array<{ publicKeyMultibase?: string }>;
};

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function createPayload(method: string, path: string, timestamp: string, body: string) {
  return `${method.toUpperCase()}\n${path}\n${timestamp}\n${digest(body)}`;
}

function trimInteger(bytes: Buffer) {
  let i = 0;
  while (i < bytes.length - 1 && bytes[i] === 0) i += 1;
  let out = bytes.slice(i);
  if (out[0] & 0x80) {
    out = Buffer.concat([Buffer.from([0]), out]);
  }
  return out;
}

function p1363ToDer(signature: Buffer) {
  if (signature.length !== 64) return null;
  const r = trimInteger(signature.subarray(0, 32));
  const s = trimInteger(signature.subarray(32, 64));
  const sequenceLength = 2 + r.length + 2 + s.length;
  return Buffer.concat([
    Buffer.from([0x30, sequenceLength, 0x02, r.length]),
    r,
    Buffer.from([0x02, s.length]),
    s,
  ]);
}

async function resolveDidPublicKey(did: string) {
  const res = await fetch(`https://plc.directory/${encodeURIComponent(did)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to resolve DID document");
  const doc = (await res.json()) as PlcDocument;
  const multibase = doc.verificationMethod?.find((x) => x.publicKeyMultibase)
    ?.publicKeyMultibase;
  if (!multibase || !multibase.startsWith("z")) {
    throw new Error("Missing DID public key");
  }
  return base58.decode(multibase.slice(1));
}

export async function requireSignedRequest(request: Request, body = "") {
  const did = request.headers.get("x-did");
  const timestamp = request.headers.get("x-timestamp");
  const signatureHeader = request.headers.get("x-signature");

  if (!did || !timestamp || !signatureHeader) {
    throw new Error("Missing signature headers");
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_SKEW_MS) {
    throw new Error("Expired timestamp");
  }

  const url = new URL(request.url);
  const payload = createPayload(request.method, url.pathname, timestamp, body);
  const msg = new TextEncoder().encode(payload);

  const encodedSignature = signatureHeader
    .replace(/^base64:/, "")
    .replace(/ /g, "+");
  const signature = Buffer.from(encodedSignature, "base64url");
  const signatureCandidates = [signature];
  const derFromP1363 = p1363ToDer(signature);
  if (derFromP1363) {
    signatureCandidates.push(derFromP1363);
  }

  let ok = false;
  const dpopJwkHeader = request.headers.get("x-dpop-jwk");
  if (dpopJwkHeader) {
    try {
      const jwk = JSON.parse(dpopJwkHeader);
      const key = createPublicKey({ key: jwk, format: "jwk" });
      ok = signatureCandidates.some((candidate) =>
        verifyNode("sha256", Buffer.from(payload, "utf8"), key, candidate),
      );
    } catch {
      ok = false;
    }
  }

  if (!ok) {
    const pub = await resolveDidPublicKey(did);
    ok = await verify(signature, msg, pub);
  }

  if (!ok) throw new Error("Invalid signature");

  return { did };
}
