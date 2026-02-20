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

export async function getAtprotoSession(): Promise<AtprotoSession | null> {
  const store = await cookies();
  const raw = store.get(ATPROTO_SESSION_COOKIE)?.value;
  if (!raw) return null;

  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as AtprotoSession;
  } catch {
    return null;
  }
}

export async function setAtprotoSession(session: AtprotoSession) {
  const store = await cookies();
  store.set(ATPROTO_SESSION_COOKIE, Buffer.from(JSON.stringify(session), "utf8").toString("base64url"), {
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
