import { NextResponse } from "next/server";
import { getSession } from "@/lib/atproto-session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ signedIn: false });
  return NextResponse.json({ signedIn: true, did: session.did, handle: session.handle, ds: session.ds });
}
