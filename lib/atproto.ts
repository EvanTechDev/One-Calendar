import { randomBytes, createHash } from "crypto";

export interface DidDocService {
  id?: string;
  type?: string;
  serviceEndpoint?: string;
}

export interface DidDoc {
  service?: DidDocService[];
}

export async function resolveHandle(handle: string): Promise<{ did: string; pds: string; }> {
  const normalized = handle.replace(/^@/, "").trim().toLowerCase();
  const didRes = await fetch(`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(normalized)}`, { cache: "no-store" });
  if (!didRes.ok) {
    throw new Error("Failed to resolve handle");
  }

  const didData = (await didRes.json()) as { did?: string };
  if (!didData.did) {
    throw new Error("No DID found for handle");
  }

  const didDocRes = await fetch(`https://plc.directory/${encodeURIComponent(didData.did)}`, { cache: "no-store" });
  if (!didDocRes.ok) {
    throw new Error("Failed to resolve DID document");
  }

  const didDoc = (await didDocRes.json()) as DidDoc;
  const pds = didDoc.service?.find((s) => s.type === "AtprotoPersonalDataServer")?.serviceEndpoint;
  if (!pds) {
    throw new Error("Could not find PDS endpoint");
  }

  return { did: didData.did, pds };
}

export function createPkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export async function getProfile(pds: string, actor: string, accessToken: string) {
  const url = `${pds.replace(/\/$/, "")}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ displayName?: string; avatar?: string; handle?: string }>;
}

export async function putRecord(params: {
  pds: string;
  repo: string;
  collection: string;
  rkey: string;
  record: Record<string, unknown>;
  accessToken: string;
}) {
  const { pds, accessToken, ...payload } = params;
  const res = await fetch(`${pds.replace(/\/$/, "")}/xrpc/com.atproto.repo.putRecord`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`putRecord failed: ${await res.text()}`);
  }
  return res.json();
}

export async function getRecord(params: {
  pds: string;
  repo: string;
  collection: string;
  rkey: string;
  accessToken?: string;
}) {
  const { pds, repo, collection, rkey, accessToken } = params;
  const res = await fetch(
    `${pds.replace(/\/$/, "")}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(repo)}&collection=${encodeURIComponent(collection)}&rkey=${encodeURIComponent(rkey)}`,
    {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      cache: "no-store",
    },
  );
  if (!res.ok) {
    throw new Error(`getRecord failed: ${await res.text()}`);
  }
  return res.json() as Promise<{ value?: Record<string, unknown> }>;
}

export async function listRecords(params: {
  pds: string;
  repo: string;
  collection: string;
  accessToken: string;
}) {
  const { pds, repo, collection, accessToken } = params;
  const res = await fetch(
    `${pds.replace(/\/$/, "")}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(repo)}&collection=${encodeURIComponent(collection)}&limit=100`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );

  if (!res.ok) {
    throw new Error(`listRecords failed: ${await res.text()}`);
  }

  return res.json() as Promise<{ records?: Array<{ uri: string; value?: Record<string, unknown> }> }>;
}

export async function deleteRecord(params: {
  pds: string;
  repo: string;
  collection: string;
  rkey: string;
  accessToken: string;
}) {
  const { pds, accessToken, ...payload } = params;
  const res = await fetch(`${pds.replace(/\/$/, "")}/xrpc/com.atproto.repo.deleteRecord`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`deleteRecord failed: ${await res.text()}`);
  }
}
