import { createSign } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { normalizeSignedPayload } from "@onecalendar/crypto";
import type { DsSignedPayload } from "@onecalendar/types";
import { getSession } from "@/lib/atproto-session";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.did) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const privateKey = process.env.ATPROTO_DID_PRIVATE_KEY;
  if (!privateKey) {
    return NextResponse.json({ error: "missing atproto signing context" }, { status: 500 });
  }

  const payload = (await request.json()) as DsSignedPayload;
  const signer = createSign("SHA256");
  signer.update(normalizeSignedPayload(payload));
  signer.end();
  const signature = signer.sign(privateKey, "base64url");

  return NextResponse.json({ did: session.did, signature });
}
