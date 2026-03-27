import { NextRequest, NextResponse } from "next/server";
import { getRecord, putRecord } from "@/lib/atproto";
import { getAtprotoSession } from "@/lib/atproto-auth";

const DS_COLLECTION = "app.onecalendar.ds";
const DS_RKEY = "self";

export async function GET() {
  const session = await getAtprotoSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const record = await getRecord({
      pds: session.pds,
      repo: session.did,
      collection: DS_COLLECTION,
      rkey: DS_RKEY,
      accessToken: session.accessToken,
      dpopPrivateKeyPem: session.dpopPrivateKeyPem,
      dpopPublicJwk: session.dpopPublicJwk,
    });

    return NextResponse.json({ ds: String(record.value?.ds || process.env.NEXT_PUBLIC_DS_URL || "") });
  } catch {
    return NextResponse.json({ ds: process.env.NEXT_PUBLIC_DS_URL || "" });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getAtprotoSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { ds?: string };
  if (!body.ds) return NextResponse.json({ error: "Missing ds" }, { status: 400 });

  await putRecord({
    pds: session.pds,
    repo: session.did,
    collection: DS_COLLECTION,
    rkey: DS_RKEY,
    accessToken: session.accessToken,
    dpopPrivateKeyPem: session.dpopPrivateKeyPem,
    dpopPublicJwk: session.dpopPublicJwk,
    record: {
      $type: DS_COLLECTION,
      ds: body.ds,
      updatedAt: new Date().toISOString(),
    },
  });

  return NextResponse.json({ success: true });
}
