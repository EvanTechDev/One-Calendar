import { createHmac, timingSafeEqual } from "node:crypto";
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

function getSessionSigningSecret() {
  return process.env.ATPROTO_SESSION_SECRET || process.env.NEXTAUTH_SECRET || "";
}

function signPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload, "utf8").digest("base64url");
}

function encodeSession(session: AtprotoSession) {
  const secret = getSessionSigningSecret();
  if (!secret) {
    throw new Error("Missing ATPROTO_SESSION_SECRET (or NEXTAUTH_SECRET) for ATProto session cookie signing");
  }

  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  const signature = signPayload(payload, secret);
  return `${payload}.${signature}`;
}

function decodeSession(raw: string): AtprotoSession | null {
  const secret = getSessionSigningSecret();
  if (!secret) return null;

  const dotIndex = raw.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === raw.length - 1) return null;

  const payload = raw.slice(0, dotIndex);
  const signature = raw.slice(dotIndex + 1);
  const expectedSignature = signPayload(payload, secret);

  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AtprotoSession;
  } catch {
    return null;
  }
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
