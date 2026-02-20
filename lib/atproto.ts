import crypto from "crypto"
import { cookies } from "next/headers"

const SESSION_COOKIE = "atproto_session"
const OAUTH_COOKIE = "atproto_oauth"

export type AtprotoSession = {
  did: string
  handle: string
  pds: string
  accessToken: string
  refreshToken?: string
  displayName?: string
  avatar?: string
}

export type AtprotoOauthState = {
  handle: string
  pds: string
  state: string
  verifier: string
}

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url")
}

function getSecret() {
  return process.env.ATPROTO_SESSION_SECRET || "dev-atproto-session-secret"
}

function sign(payload: string) {
  return base64url(crypto.createHmac("sha256", getSecret()).update(payload).digest())
}

function pack<T>(value: T) {
  const payload = base64url(JSON.stringify(value))
  return `${payload}.${sign(payload)}`
}

function unpack<T>(raw?: string): T | null {
  if (!raw) return null
  const [payload, mac] = raw.split(".")
  if (!payload || !mac) return null
  if (sign(payload) !== mac) return null
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T
  } catch {
    return null
  }
}

export async function getAtprotoSession(): Promise<AtprotoSession | null> {
  const store = await cookies()
  return unpack<AtprotoSession>(store.get(SESSION_COOKIE)?.value)
}

export async function setAtprotoSession(session: AtprotoSession) {
  const store = await cookies()
  store.set(SESSION_COOKIE, pack(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
}

export async function clearAtprotoSession() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export async function setAtprotoOauthState(payload: AtprotoOauthState) {
  const store = await cookies()
  store.set(OAUTH_COOKIE, pack(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  })
}

export async function getAtprotoOauthState() {
  const store = await cookies()
  return unpack<AtprotoOauthState>(store.get(OAUTH_COOKIE)?.value)
}

export async function clearAtprotoOauthState() {
  const store = await cookies()
  store.delete(OAUTH_COOKIE)
}

export async function resolveAtprotoHandle(handle: string) {
  const resolved = await fetch(`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`)
  if (!resolved.ok) throw new Error("Failed to resolve handle")
  const { did } = (await resolved.json()) as { did: string }
  const plc = await fetch(`https://plc.directory/${did}`)
  if (!plc.ok) throw new Error("Failed to resolve PDS")
  const doc = await plc.json() as { service?: Array<{ id: string; serviceEndpoint: string }> }
  const pds = doc.service?.find((s) => s.id === "#atproto_pds")?.serviceEndpoint
  if (!pds) throw new Error("No PDS found for handle")
  return { did, pds }
}

export function createPkce() {
  const verifier = base64url(crypto.randomBytes(32))
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest())
  return { verifier, challenge }
}

export function createAtprotoStateToken(verifier: string) {
  const issuedAt = Date.now().toString(36)
  const payload = `${issuedAt}.${verifier}`
  const signature = sign(payload).slice(0, 22)
  return `${payload}.${signature}`
}

export function parseAtprotoStateToken(token: string, maxAgeMs = 10 * 60 * 1000): { verifier: string } | null {
  const [issuedAt, verifier, signature] = token.split(".")
  if (!issuedAt || !verifier || !signature) return null

  const payload = `${issuedAt}.${verifier}`
  const expectedSignature = sign(payload).slice(0, 22)
  if (signature !== expectedSignature) return null

  const issuedAtMs = parseInt(issuedAt, 36)
  if (!Number.isFinite(issuedAtMs)) return null
  if (Date.now() - issuedAtMs > maxAgeMs) return null

  return { verifier }
}

export async function putRecord(session: AtprotoSession, collection: string, rkey: string, record: unknown) {
  const res = await fetch(`${session.pds}/xrpc/com.atproto.repo.putRecord`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify({
      repo: session.did,
      collection,
      rkey,
      record,
    }),
  })
  if (!res.ok) {
    throw new Error(`putRecord failed: ${res.status}`)
  }
}

export async function getRecordFromPds(pds: string, repo: string, collection: string, rkey: string) {
  const res = await fetch(`${pds}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(repo)}&collection=${encodeURIComponent(collection)}&rkey=${encodeURIComponent(rkey)}`)
  if (!res.ok) {
    if (res.status === 400 || res.status === 404) return null
    throw new Error(`getRecord failed: ${res.status}`)
  }
  const data = await res.json() as { value?: any }
  return data.value ?? null
}

export async function listRecords(session: AtprotoSession, collection: string) {
  const res = await fetch(`${session.pds}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(session.did)}&collection=${encodeURIComponent(collection)}&limit=100`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
  })
  if (!res.ok) throw new Error(`listRecords failed: ${res.status}`)
  const data = await res.json() as { records?: Array<{ uri: string; value: any }> }
  return data.records || []
}

export async function deleteRecord(session: AtprotoSession, collection: string, rkey: string) {
  const res = await fetch(`${session.pds}/xrpc/com.atproto.repo.deleteRecord`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify({ repo: session.did, collection, rkey }),
  })
  if (!res.ok) throw new Error(`deleteRecord failed: ${res.status}`)
}
