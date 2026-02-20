import { randomBytes, createHash } from "crypto";
import { createDpopProof, type DpopPublicJwk } from "@/lib/dpop";

export interface DidDocService {
  id?: string;
  type?: string;
  serviceEndpoint?: string;
}

export interface DidDoc {
  service?: DidDocService[];
}

export async function resolveHandle(handle: string): Promise<{ did: string; pds: string }> {
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

async function createAuthHeaders(params: {
  url: string;
  method: string;
  accessToken?: string;
  dpopPrivateKeyPem?: string;
  dpopPublicJwk?: DpopPublicJwk;
  contentType?: string;
  nonce?: string;
}) {
  const headers: Record<string, string> = {};
  if (params.contentType) headers["Content-Type"] = params.contentType;

  if (!params.accessToken) return headers;

  if (params.dpopPrivateKeyPem && params.dpopPublicJwk) {
    const dpopProof = createDpopProof({
      htu: params.url,
      htm: params.method,
      privateKeyPem: params.dpopPrivateKeyPem,
      publicJwk: params.dpopPublicJwk,
      accessToken: params.accessToken,
      nonce: params.nonce,
    });

    headers.Authorization = `DPoP ${params.accessToken}`;
    headers.DPoP = dpopProof;
    return headers;
  }

  headers.Authorization = `Bearer ${params.accessToken}`;
  return headers;
}

async function fetchWithDpopNonceRetry(params: {
  url: string;
  method: "GET" | "POST";
  accessToken?: string;
  dpopPrivateKeyPem?: string;
  dpopPublicJwk?: DpopPublicJwk;
  contentType?: string;
  body?: string;
}) {
  const doFetch = async (nonce?: string) =>
    fetch(params.url, {
      method: params.method,
      headers: await createAuthHeaders({
        url: params.url,
        method: params.method,
        accessToken: params.accessToken,
        dpopPrivateKeyPem: params.dpopPrivateKeyPem,
        dpopPublicJwk: params.dpopPublicJwk,
        contentType: params.contentType,
        nonce,
      }),
      body: params.body,
      cache: "no-store",
    });

  let res = await doFetch();
  if (res.ok) return res;

  let nonce = res.headers.get("DPoP-Nonce") || res.headers.get("dpop-nonce");
  const hasDpop = !!params.accessToken && !!params.dpopPrivateKeyPem && !!params.dpopPublicJwk;

  if (hasDpop && !nonce) {
    const body = await res.clone().text();
    try {
      const parsed = JSON.parse(body) as { dpop_nonce?: string; nonce?: string };
      nonce = parsed.dpop_nonce || parsed.nonce;
    } catch {
      nonce = nonce || undefined;
    }
  }

  if (hasDpop && nonce) {
    res = await doFetch(nonce);
  }

  return res;
}

export async function getProfile(pds: string, actor: string, accessToken: string, dpop?: { privateKeyPem?: string; publicJwk?: DpopPublicJwk }) {
  const url = `${pds.replace(/\/$/, "")}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`;
  const res = await fetchWithDpopNonceRetry({
    url,
    method: "GET",
    accessToken,
    dpopPrivateKeyPem: dpop?.privateKeyPem,
    dpopPublicJwk: dpop?.publicJwk,
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ displayName?: string; avatar?: string; handle?: string }>;
}


export async function getActorProfileRecord(params: {
  pds: string;
  repo: string;
  accessToken: string;
  dpopPrivateKeyPem?: string;
  dpopPublicJwk?: DpopPublicJwk;
}) {
  const record = await getRecord({
    pds: params.pds,
    repo: params.repo,
    collection: "app.bsky.actor.profile",
    rkey: "self",
    accessToken: params.accessToken,
    dpopPrivateKeyPem: params.dpopPrivateKeyPem,
    dpopPublicJwk: params.dpopPublicJwk,
  });

  return record.value as
    | {
        displayName?: string;
        avatar?: { ref?: { $link?: string } };
      }
    | undefined;
}

export function profileAvatarBlobUrl(params: { pds: string; did: string; cid?: string }) {
  if (!params.cid) return undefined;
  return `${params.pds.replace(/\/$/, "")}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(params.did)}&cid=${encodeURIComponent(params.cid)}`;
}

export async function putRecord(params: {
  pds: string;
  repo: string;
  collection: string;
  rkey: string;
  record: Record<string, unknown>;
  accessToken: string;
  dpopPrivateKeyPem?: string;
  dpopPublicJwk?: DpopPublicJwk;
}) {
  const { pds, accessToken, dpopPrivateKeyPem, dpopPublicJwk, ...payload } = params;
  const url = `${pds.replace(/\/$/, "")}/xrpc/com.atproto.repo.putRecord`;
  const res = await fetchWithDpopNonceRetry({
    url,
    method: "POST",
    accessToken,
    dpopPrivateKeyPem,
    dpopPublicJwk,
    contentType: "application/json",
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
  dpopPrivateKeyPem?: string;
  dpopPublicJwk?: DpopPublicJwk;
}) {
  const { pds, repo, collection, rkey, accessToken, dpopPrivateKeyPem, dpopPublicJwk } = params;
  const url = `${pds.replace(/\/$/, "")}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(repo)}&collection=${encodeURIComponent(collection)}&rkey=${encodeURIComponent(rkey)}`;
  const res = await fetchWithDpopNonceRetry({
    url,
    method: "GET",
    accessToken,
    dpopPrivateKeyPem,
    dpopPublicJwk,
  });
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
  dpopPrivateKeyPem?: string;
  dpopPublicJwk?: DpopPublicJwk;
}) {
  const { pds, repo, collection, accessToken, dpopPrivateKeyPem, dpopPublicJwk } = params;
  const url = `${pds.replace(/\/$/, "")}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(repo)}&collection=${encodeURIComponent(collection)}&limit=100`;
  const res = await fetchWithDpopNonceRetry({
    url,
    method: "GET",
    accessToken,
    dpopPrivateKeyPem,
    dpopPublicJwk,
  });

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
  dpopPrivateKeyPem?: string;
  dpopPublicJwk?: DpopPublicJwk;
}) {
  const { pds, accessToken, dpopPrivateKeyPem, dpopPublicJwk, ...payload } = params;
  const url = `${pds.replace(/\/$/, "")}/xrpc/com.atproto.repo.deleteRecord`;
  const res = await fetchWithDpopNonceRetry({
    url,
    method: "POST",
    accessToken,
    dpopPrivateKeyPem,
    dpopPublicJwk,
    contentType: "application/json",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`deleteRecord failed: ${await res.text()}`);
  }
}
