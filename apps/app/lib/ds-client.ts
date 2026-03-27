"use client";

import { normalizeSignedPayload } from "@onecalendar/crypto";
import type { DsSignedPayload } from "@onecalendar/types";

async function signPayload(payload: DsSignedPayload) {
  const res = await fetch("/api/atproto/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { did: string; signature: string };
}

export async function didSignedFetch<T>(dsUrl: string, path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  const body = typeof init?.body === "string" ? init.body : init?.body ? JSON.stringify(init.body) : "";
  const timestamp = new Date().toISOString();
  const payload: DsSignedPayload = { method, path, timestamp, body };

  const signed = await signPayload(payload);

  const res = await fetch(`${dsUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    method,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
      "X-DID": signed.did,
      "X-Timestamp": timestamp,
      "X-Signature": signed.signature,
      "X-Signed-Payload": normalizeSignedPayload(payload),
    },
    body: body || undefined,
  });

  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}
