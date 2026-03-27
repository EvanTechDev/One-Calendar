import { cookies } from "next/headers";

export type AtprotoSession = {
  did: string;
  handle: string;
  ds: string;
};

const COOKIE_NAME = "atproto_demo_session";

export async function getSession(): Promise<AtprotoSession | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) {
    const did = process.env.ATPROTO_DEMO_DID;
    if (!did) return null;
    return { did, handle: process.env.ATPROTO_DEMO_HANDLE || did, ds: process.env.NEXT_PUBLIC_DS_URL || "http://localhost:4001" };
  }
  try {
    return JSON.parse(raw) as AtprotoSession;
  } catch {
    return null;
  }
}

export async function setSession(session: AtprotoSession) {
  const store = await cookies();
  store.set(COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}
