import { NextResponse } from "next/server";
import { getAtprotoSession } from "@/lib/atproto-auth";
import { getRecord, putRecord } from "@/lib/atproto";

const COLLECTION = "app.onecalendar.profile";
const RKEY = "self";

export async function GET() {
  const session = await getAtprotoSession();
  if (!session) return NextResponse.json({ signedIn: false }, { status: 401 });
  try {
    const record = await getRecord({
      pds: session.pds,
      repo: session.did,
      collection: COLLECTION,
      rkey: RKEY,
      accessToken: session.accessToken,
      dpopPrivateKeyPem: session.dpopPrivateKeyPem,
      dpopPublicJwk: session.dpopPublicJwk
    });
    return NextResponse.json({ signedIn: true, ds: String(record.value?.ds || "") });
  } catch {
    return NextResponse.json({ signedIn: true, ds: "" });
  }
}

export async function PUT(request: Request) {
  const session = await getAtprotoSession();
  if (!session) return NextResponse.json({ signedIn: false }, { status: 401 });
  const body = await request.json();
  if (!body.ds || typeof body.ds !== "string") {
    return NextResponse.json({ error: "invalid_ds" }, { status: 400 });
  }
  await putRecord({
    pds: session.pds,
    repo: session.did,
    collection: COLLECTION,
    rkey: RKEY,
    accessToken: session.accessToken,
    dpopPrivateKeyPem: session.dpopPrivateKeyPem,
    dpopPublicJwk: session.dpopPublicJwk,
    record: {
      $type: COLLECTION,
      ds: body.ds,
      updatedAt: new Date().toISOString()
    }
  });
  return NextResponse.json({ ok: true });
}
