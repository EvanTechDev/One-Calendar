import { signRequestPayload } from "@onecalendar/crypto";

type Session = {
  signedIn: boolean;
  did?: string;
  dpopPrivateKeyPem?: string;
};

let memorySession: Session | null = null;

async function getSession() {
  if (memorySession) return memorySession;
  const res = await fetch("/api/atproto/session", { cache: "no-store" });
  const json = (await res.json()) as Session;
  memorySession = json;
  return json;
}

export async function signedDsFetch(dsBaseUrl: string, path: string, init?: RequestInit) {
  const session = await getSession();
  if (!session.signedIn || !session.did || !session.dpopPrivateKeyPem) {
    throw new Error("atproto_signin_required");
  }
  const method = (init?.method || "GET").toUpperCase();
  const timestamp = String(Date.now());
  const body = typeof init?.body === "string" ? init.body : "";
  const payload = `${method}\n${path}\n${timestamp}\n${body}`;
  const signature = await signRequestPayload(session.dpopPrivateKeyPem, payload);
  const headers = new Headers(init?.headers || {});
  headers.set("Content-Type", "application/json");
  headers.set("X-DID", session.did);
  headers.set("X-Timestamp", timestamp);
  headers.set("X-Signature", signature);
  const url = `${dsBaseUrl.replace(/\/$/, "")}${path}`;
  return fetch(url, {
    ...init,
    method,
    headers,
    body: body || undefined,
    cache: "no-store"
  });
}
