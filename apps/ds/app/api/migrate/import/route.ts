import { NextRequest, NextResponse } from "next/server";
import { migrateDb, pool } from "@/lib/db";
import { verifyRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    await migrateDb();
    const { did } = await verifyRequest(request);
    const body = await request.json();
    await client.query("BEGIN");
    for (const share of body.shares || []) {
      await client.query(
        "INSERT INTO shares(id,did,ciphertext,metadata_ciphertext) VALUES($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET did=EXCLUDED.did,ciphertext=EXCLUDED.ciphertext,metadata_ciphertext=EXCLUDED.metadata_ciphertext",
        [share.id, did, share.ciphertext, share.metadataCiphertext || null]
      );
    }
    for (const backup of body.calendarBackups || []) {
      await client.query(
        "INSERT INTO calendar_backups(id,did,ciphertext) VALUES($1,$2,$3) ON CONFLICT (id) DO UPDATE SET did=EXCLUDED.did,ciphertext=EXCLUDED.ciphertext",
        [backup.id, did, backup.ciphertext]
      );
    }
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 401 });
  } finally {
    client.release();
  }
}
