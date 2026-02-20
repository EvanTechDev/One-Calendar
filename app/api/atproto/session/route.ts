import { NextResponse } from "next/server";
import { getAtprotoSession } from "@/lib/atproto-auth";

export async function GET() {
  const session = await getAtprotoSession();
  if (!session) return NextResponse.json({ signedIn: false });
  return NextResponse.json({
    signedIn: true,
    handle: session.handle,
    did: session.did,
    pds: session.pds,
    displayName: session.displayName,
    avatar: session.avatar,
  });
}
