import { NextResponse } from "next/server"
import { getAtprotoSession } from "@/lib/atproto"

export async function GET() {
  const session = await getAtprotoSession()
  if (!session) return NextResponse.json({ authenticated: false })
  return NextResponse.json({
    authenticated: true,
    handle: session.handle,
    displayName: session.displayName,
    avatar: session.avatar,
    did: session.did,
  })
}
