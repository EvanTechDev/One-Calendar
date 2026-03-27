import { NextResponse } from "next/server";
import { clearAtprotoSession } from "@/lib/atproto-auth";

export async function POST() {
  await clearAtprotoSession();
  return NextResponse.json({ success: true });
}
