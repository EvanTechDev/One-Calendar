import { NextRequest, NextResponse } from "next/server";
import { getSession, setSession } from "@/lib/atproto-session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  return NextResponse.json({ ds: session.ds });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const body = (await request.json()) as { ds?: string };
  if (!body.ds) return NextResponse.json({ error: "missing ds" }, { status: 400 });

  await setSession({ ...session, ds: body.ds });
  return NextResponse.json({ success: true });
}
