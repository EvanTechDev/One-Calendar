import { createHash, createSign } from "node:crypto";
import type { AtprotoSession } from "@/lib/atproto-auth";

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function createPayload(method: string, path: string, timestamp: string, body: string) {
  return `${method.toUpperCase()}\n${path}\n${timestamp}\n${digest(body)}`;
}

function signPayload(payload: string, privateKeyPem: string) {
  const signer = createSign("SHA256");
  signer.update(payload);
  signer.end();
  return signer.sign(privateKeyPem).toString("base64");
}

export async function signedDsFetch(params: {
  session: AtprotoSession;
  ds: string;
  path: string;
  method: "GET" | "POST" | "DELETE";
  body?: unknown;
}) {
  if (!params.session.dpopPrivateKeyPem || !params.session.dpopPublicJwk) {
    throw new Error("ATProto DPoP key unavailable for signed DS request");
  }

  const ds = params.ds.replace(/\/$/, "");
  const path = params.path.startsWith("/") ? params.path : `/${params.path}`;
  const timestamp = Date.now().toString();
  const bodyText =
    params.body === undefined || params.method === "GET"
      ? ""
      : JSON.stringify(params.body);

  const payload = createPayload(params.method, path, timestamp, bodyText);
  const signature = signPayload(payload, params.session.dpopPrivateKeyPem);

  const headers: Record<string, string> = {
    "x-did": params.session.did,
    "x-timestamp": timestamp,
    "x-signature": signature,
    "x-dpop-jwk": JSON.stringify(params.session.dpopPublicJwk),
  };

  if (params.method !== "GET") {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`${ds}${path}`, {
    method: params.method,
    headers,
    body: params.method === "GET" ? undefined : bodyText,
    cache: "no-store",
  });
}
