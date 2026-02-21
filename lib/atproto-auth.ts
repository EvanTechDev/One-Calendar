import { createDecipheriv, createHash, createCipheriv, hkdfSync, randomBytes } from "node:crypto";
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

export interface KeyEntry {
  kid: string;
  secret: string;
}

function shouldUseSecureCookies() {
  return process.env.NODE_ENV === "production";
}

export function getKeyEntries(): KeyEntry[] {
  const secret = process.env.ATPROTO_SESSION_SECRET?.trim();
  if (!secret) return [];
  return [{ kid: "v1", secret }];
}

function deriveKey(secret: string, kid: string) {
  const salt = createHash("sha256").update(`atproto-cookie-salt:${kid}`, "utf8").digest();
  const info = Buffer.from("one-calendar:atproto:cookie:v2", "utf8");
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), salt, info, 32));
}

function deriveLegacyKey(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest();
}

export function sealJsonPayload(payload: unknown, key: KeyEntry) {
  const iv = randomBytes(12);
  const derivedKey = deriveKey(key.secret, key.kid);
  const cipher = createCipheriv("aes-256-gcm", derivedKey, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v2.${key.kid}.${iv.toString("base64url")}.${ciphertext.toString("base64url")}.${tag.toString("base64url")}`;
}

export function unsealJsonPayload<T>(raw: string): T | null {
  const v2parts = raw.split(".");
  if (v2parts.length === 5 && v2parts[0] === "v2") {
    const [, kid, ivRaw, ciphertextRaw, tagRaw] = v2parts;
    const keyEntry = getKeyEntries().find((entry) => entry.kid === kid);
    if (!keyEntry) return null;

    try {
      const iv = Buffer.from(ivRaw, "base64url");
      const ciphertext = Buffer.from(ciphertextRaw, "base64url");
      const tag = Buffer.from(tagRaw, "base64url");
      const key = deriveKey(keyEntry.secret, keyEntry.kid);

      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
      return JSON.parse(plaintext) as T;
    } catch {
      return null;
    }
  }

  // Backward compatibility with previous v1 format: v1.iv.ciphertext.tag
  if (v2parts.length === 4 && v2parts[0] === "v1") {
    const keys = getKeyEntries();
    for (const keyEntry of keys) {
      try {
        const iv = Buffer.from(v2parts[1], "base64url");
        const ciphertext = Buffer.from(v2parts[2], "base64url");
        const tag = Buffer.from(v2parts[3], "base64url");
        const key = deriveLegacyKey(keyEntry.secret);

        const decipher = createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
        return JSON.parse(plaintext) as T;
      } catch {
        // try next key
      }
    }
  }

  return null;
}

function encodeSession(session: AtprotoSession) {
  const keys = getKeyEntries();
  const activeKey = keys[0];
  if (!activeKey) {
    throw new Error("Missing ATProto cookie key. Set ATPROTO_SESSION_SECRET");
  }

  return sealJsonPayload(session, activeKey);
}

function decodeSession(raw: string): AtprotoSession | null {
  return unsealJsonPayload<AtprotoSession>(raw);
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
