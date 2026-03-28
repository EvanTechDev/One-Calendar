import { NextResponse } from "next/server";
import { getRecord, putRecord } from "@/lib/atproto";
import { getAtprotoSession } from "@/lib/atproto-auth";

const DS_COLLECTION = "app.onecalendar.ds";
const DS_RKEY = "self";

export async function GET() {
  const atproto = await getAtprotoSession();
  if (!atproto) {
    return NextResponse.json({ error: "ATProto login required" }, { status: 401 });
  }

  try {
    const record = await getRecord({
      pds: atproto.pds,
      repo: atproto.did,
      collection: DS_COLLECTION,
      rkey: DS_RKEY,
      accessToken: atproto.accessToken,
      dpopPrivateKeyPem: atproto.dpopPrivateKeyPem,
      dpopPublicJwk: atproto.dpopPublicJwk,
    });

    return NextResponse.json({
      did: atproto.did,
      ds: (record.value?.ds as string | undefined) || null,
    });
  } catch {
    return NextResponse.json({ did: atproto.did, ds: null });
  }
}

export async function POST(request: Request) {
  const atproto = await getAtprotoSession();
  if (!atproto) {
    return NextResponse.json({ error: "ATProto login required" }, { status: 401 });
  }

  const body = (await request.json()) as { ds?: string };
  const ds = body.ds?.trim();
  if (!ds) {
    return NextResponse.json({ error: "ds is required" }, { status: 400 });
  }

  await putRecord({
    pds: atproto.pds,
    repo: atproto.did,
    collection: DS_COLLECTION,
    rkey: DS_RKEY,
    record: {
      $type: DS_COLLECTION,
      ds,
      updatedAt: new Date().toISOString(),
    },
    accessToken: atproto.accessToken,
    dpopPrivateKeyPem: atproto.dpopPrivateKeyPem,
    dpopPublicJwk: atproto.dpopPublicJwk,
  });

  return NextResponse.json({ success: true, did: atproto.did, ds });
}
