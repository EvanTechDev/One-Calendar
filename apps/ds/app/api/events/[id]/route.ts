import { NextRequest, NextResponse } from "next/server";
import { migrateDb, pool } from "@/lib/db";
import { verifyRequest } from "@/lib/auth";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await migrateDb();
    const { did } = await verifyRequest(request);
    const { id } = await context.params;
    const body = await request.json();
    await pool.query("UPDATE events SET payload_ciphertext=$1, updated_at=NOW() WHERE id=$2 AND did=$3", [body.payloadCiphertext, id, did]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 401 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await migrateDb();
    const { did } = await verifyRequest(request);
    const { id } = await context.params;
    await pool.query("DELETE FROM events WHERE id=$1 AND did=$2", [id, did]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 401 });
  }
}
