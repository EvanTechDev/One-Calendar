import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { DpopPublicJwk } from "@/lib/dpop";
import { cookies } from "next/headers";

export const ATPROTO_SESSION_COOKIE = "atproto_session";

export interface AtprotoSession {
  did: string;
  handle: string;
  pds: string;
  accessToken: string;
  refreshToken?: string;
  displayName?: string;
  avatar?: string;
  dpopPrivateKeyPem?: string;
  dpopPublicJwk?: DpopPublicJwk;
}

function shouldUseSecureCookies() {
  return process.env.NODE_ENV === "production";
}

export function getAtprotoCookieSecret() {
  return process.env.ATPROTO_SESSION_SECRET || process.env.NEXTAUTH_SECRET || "";
}

function deriveKey(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest();
}

export function sealJsonPayload(payload: unknown, secret: string) {
  const iv = randomBytes(12);
  const key = deriveKey(secret);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${ciphertext.toString("base64url")}.${tag.toString("base64url")}`;
}

export function unsealJsonPayload<T>(raw: string, secret: string): T | null {
  const parts = raw.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;

  try {
    const iv = Buffer.from(parts[1], "base64url");
    const ciphertext = Buffer.from(parts[2], "base64url");
    const tag = Buffer.from(parts[3], "base64url");
    const key = deriveKey(secret);

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    return JSON.parse(plaintext) as T;
  } catch {
    return null;
  }
}

function encodeSession(session: AtprotoSession) {
  const secret = getAtprotoCookieSecret();
  if (!secret) {
    throw new Error("Missing ATPROTO_SESSION_SECRET (or NEXTAUTH_SECRET) for ATProto session cookie protection");
  }

  return sealJsonPayload(session, secret);
}

function decodeSession(raw: string): AtprotoSession | null {
  const secret = getAtprotoCookieSecret();
  if (!secret) return null;
  return unsealJsonPayload<AtprotoSession>(raw, secret);
}

export async function getAtprotoSession(): Promise<AtprotoSession | null> {
  const store = await cookies();
  const raw = store.get(ATPROTO_SESSION_COOKIE)?.value;
  if (!raw) return null;

  const decoded = decodeSession(raw);
  if (!decoded) {
    store.delete(ATPROTO_SESSION_COOKIE);
  }

  return decoded;
}

export async function setAtprotoSession(session: AtprotoSession) {
  const store = await cookies();
  const value = encodeSession(session);
  store.set(ATPROTO_SESSION_COOKIE, value, {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearAtprotoSession() {
  const store = await cookies();
  store.delete(ATPROTO_SESSION_COOKIE);
}
