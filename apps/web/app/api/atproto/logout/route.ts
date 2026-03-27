import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  return NextResponse.redirect(new URL("/", request.url));
}

/*
import { NextResponse } from "next/server";
import { clearAtprotoSession } from "@/lib/atproto-auth";

export async function POST() {
  await clearAtprotoSession();
  return NextResponse.json({ success: true });
}

*/
