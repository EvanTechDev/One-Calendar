import { NextRequest, NextResponse } from "next/server";
import { migrateDb, pool } from "@/lib/db";
import { verifyRequest } from "@/lib/auth";

export async function DELETE(request: NextRequest) {
  const client = await pool.connect();
  try {
    await migrateDb();
    const { did } = await verifyRequest(request);
    await client.query("BEGIN");
    await client.query("DELETE FROM shares WHERE did=$1", [did]);
    await client.query("DELETE FROM calendar_backups WHERE did=$1", [did]);
    await client.query("DELETE FROM events WHERE did=$1", [did]);
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 401 });
  } finally {
    client.release();
  }
}
