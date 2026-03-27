import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifyRequest } from "@/lib/auth";

export async function DELETE(request: NextRequest) {
  const client = await pool.connect();
  try {
    const { did } = await verifyRequest(request);
    await client.query("BEGIN");
    await client.query(`DELETE FROM shares WHERE did = $1`, [did]);
    await client.query(`DELETE FROM calendar_data WHERE did = $1`, [did]);
    await client.query("COMMIT");
    return NextResponse.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error instanceof Error ? error.message : "unauthorized" }, { status: 401 });
  } finally {
    client.release();
  }
}
