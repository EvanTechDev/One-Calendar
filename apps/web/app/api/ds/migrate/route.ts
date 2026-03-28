import { NextResponse } from "next/server";
import { getRecord, putRecord } from "@/lib/atproto";
import { getAtprotoSession } from "@/lib/atproto-auth";

const DS_COLLECTION = "app.onecalendar.ds";
const DS_RKEY = "self";

export async function POST(request: Request) {
  const atproto = await getAtprotoSession();
  if (!atproto) {
    return NextResponse.json({ error: "ATProto login required" }, { status: 401 });
  }

  const body = (await request.json()) as { toDs?: string };
  const toDs = body.toDs?.trim();
  if (!toDs) {
    return NextResponse.json({ error: "toDs is required" }, { status: 400 });
  }

  const current = await getRecord({
    pds: atproto.pds,
    repo: atproto.did,
    collection: DS_COLLECTION,
    rkey: DS_RKEY,
    accessToken: atproto.accessToken,
    dpopPrivateKeyPem: atproto.dpopPrivateKeyPem,
    dpopPublicJwk: atproto.dpopPublicJwk,
  }).catch(() => null);

  const fromDs = (current?.value?.ds as string | undefined)?.trim();
  if (!fromDs) {
    return NextResponse.json(
      { error: "No source DS record found on app.onecalendar.ds" },
      { status: 400 },
    );
  }

  if (fromDs === toDs) {
    return NextResponse.json({ success: true, skipped: true, ds: toDs });
  }

  // Atomic-like flow: export -> import -> cleanup -> update DS record.
  const exportRes = await fetch(`${fromDs.replace(/\/$/, "")}/api/migrate/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ did: atproto.did }),
    cache: "no-store",
  });

  if (!exportRes.ok) {
    return NextResponse.json({ error: "Failed to export from source DS" }, { status: 502 });
  }

  const payload = await exportRes.json();

  const importRes = await fetch(`${toDs.replace(/\/$/, "")}/api/migrate/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!importRes.ok) {
    return NextResponse.json({ error: "Failed to import into target DS" }, { status: 502 });
  }

  const cleanupRes = await fetch(`${fromDs.replace(/\/$/, "")}/api/migrate/cleanup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ did: atproto.did }),
    cache: "no-store",
  });

  if (!cleanupRes.ok) {
    return NextResponse.json({ error: "Cleanup on source DS failed" }, { status: 502 });
  }

  await putRecord({
    pds: atproto.pds,
    repo: atproto.did,
    collection: DS_COLLECTION,
    rkey: DS_RKEY,
    record: {
      $type: DS_COLLECTION,
      ds: toDs,
      updatedAt: new Date().toISOString(),
    },
    accessToken: atproto.accessToken,
    dpopPrivateKeyPem: atproto.dpopPrivateKeyPem,
    dpopPublicJwk: atproto.dpopPublicJwk,
  });

  return NextResponse.json({ success: true, fromDs, toDs, switched: true });
}
