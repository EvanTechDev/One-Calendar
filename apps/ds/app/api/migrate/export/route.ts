import { NextRequest, NextResponse } from "next/server";
import { migrateDb, pool } from "@/lib/db";
import { verifyRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await migrateDb();
    const { did } = await verifyRequest(request);
    const [shares, calendarBackups] = await Promise.all([
      pool.query("SELECT id,did,ciphertext,metadata_ciphertext,created_at FROM shares WHERE did=$1", [did]),
      pool.query("SELECT id,did,ciphertext,created_at FROM calendar_backups WHERE did=$1", [did])
    ]);
    return NextResponse.json({ shares: shares.rows, calendarBackups: calendarBackups.rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 401 });
  }
}
