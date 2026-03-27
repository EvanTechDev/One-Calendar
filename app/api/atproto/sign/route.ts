import { NextRequest, NextResponse } from "next/server";
import { createSign } from "node:crypto";
import { getAtprotoSession } from "@/lib/atproto-auth";
import { buildSignedPayload } from "@/lib/ds/signature";

export async function POST(request: NextRequest) {
  const session = await getAtprotoSession();
  if (!session?.did || !session.dpopPrivateKeyPem) {
    return NextResponse.json({ error: "No signer session" }, { status: 401 });
  }

  const body = (await request.json()) as {
    method?: string;
    path?: string;
    timestamp?: string;
    body?: string;
  };

  if (!body.method || !body.path || !body.timestamp || typeof body.body !== "string") {
    return NextResponse.json({ error: "Invalid sign payload" }, { status: 400 });
  }

  const normalized = buildSignedPayload({
    method: body.method,
    path: body.path,
    timestamp: body.timestamp,
    body: body.body,
  });

  const signer = createSign("SHA256");
  signer.update(normalized);
  signer.end();
  const signature = signer.sign(session.dpopPrivateKeyPem, "base64url");

  return NextResponse.json({ did: session.did, signature, algorithm: "ES256K" });
}
