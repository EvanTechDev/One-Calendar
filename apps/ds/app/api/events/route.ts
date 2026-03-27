import { NextRequest, NextResponse } from "next/server";
import { migrateDb, pool } from "@/lib/db";
import { verifyRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await migrateDb();
    const { did } = await verifyRequest(request);
    const result = await pool.query("SELECT id, did, payload_ciphertext, created_at, updated_at FROM events WHERE did=$1 ORDER BY created_at DESC", [did]);
    return NextResponse.json({ events: result.rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await migrateDb();
    const { did } = await verifyRequest(request);
    const body = await request.json();
    if (!body.id || !body.payloadCiphertext) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }
    await pool.query("INSERT INTO events(id,did,payload_ciphertext) VALUES($1,$2,$3) ON CONFLICT (id) DO UPDATE SET payload_ciphertext=EXCLUDED.payload_ciphertext, updated_at=NOW()", [body.id, did, body.payloadCiphertext]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 401 });
  }
}
