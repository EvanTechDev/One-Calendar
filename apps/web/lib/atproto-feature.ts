import { NextResponse } from "next/server";

export const ATPROTO_DISABLED =
  process.env.NEXT_PUBLIC_DISABLE_ATPROTO === "1" ||
  process.env.NEXT_PUBLIC_DISABLE_ATPROTO === "true";

export function atprotoDisabledResponse() {
  return NextResponse.json(
    { error: "ATProto channel is disabled" },
    { status: 410 },
  );
}
