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
  const appToken = process.env.DS_APP_TOKEN;
  if (!appToken) {
    throw new Error("DS_APP_TOKEN is not configured");
  }
  const incomingToken = request.headers.get("x-app-token");
  if (incomingToken !== appToken) {
    throw new Error("Invalid app token");
  }

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

  let ok = false;
  const dpopJwkHeader = request.headers.get("x-dpop-jwk");
  if (dpopJwkHeader) {
    try {
      const jwk = JSON.parse(dpopJwkHeader);
      const key = createPublicKey({ key: jwk, format: "jwk" });
      ok = verifyNode("sha256", Buffer.from(payload, "utf8"), key, signature);
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
