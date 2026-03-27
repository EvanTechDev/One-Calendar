"use client";

import { buildSignedPayload } from "@/lib/ds/signature";

async function getDidSignature(input: {
  method: string;
  path: string;
  timestamp: string;
  body: string;
}) {
  const res = await fetch("/api/atproto/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`sign failed: ${text}`);
  }

  const data = (await res.json()) as { did: string; signature: string };
  return data;
}

export async function signedDsFetch<T>(dsBaseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  const body = typeof init?.body === "string" ? init.body : init?.body ? JSON.stringify(init.body) : "";
  const timestamp = new Date().toISOString();

  const toSign = buildSignedPayload({
    method,
    path,
    timestamp,
    body,
  });

  const { did, signature } = await getDidSignature({ method, path, timestamp, body });

  const response = await fetch(`${dsBaseUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    method,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
      "X-DID": did,
      "X-Timestamp": timestamp,
      "X-Signature": signature,
      "X-Signed-Payload": toSign,
    },
    body: body || undefined,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as T;
}
