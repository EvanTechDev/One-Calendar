import { NextResponse } from "next/server";

export const ATPROTO_DISABLED = false;

export function atprotoDisabledResponse() {
  return NextResponse.json({ error: "ATProto channel is disabled" }, { status: 410 });
}

/*
import { NextResponse } from "next/server";

export const ATPROTO_DISABLED = true;

export function atprotoDisabledResponse() {
  return NextResponse.json({ error: "ATProto channel is disabled" }, { status: 410 });
}
*/
