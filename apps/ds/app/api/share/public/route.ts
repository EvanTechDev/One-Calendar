import { NextRequest, NextResponse } from "next/server";
import { pool, migrateDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    await migrateDb();
    const did = request.nextUrl.searchParams.get("did");
    const id = request.nextUrl.searchParams.get("id");
    if (!did || !id) return NextResponse.json({ error: "missing_params" }, { status: 400 });
    const result = await pool.query("SELECT ciphertext, metadata_ciphertext FROM shares WHERE id=$1 AND did=$2", [id, did]);
    if (!result.rowCount) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const row = result.rows[0];
    return NextResponse.json({ data: row.ciphertext, metadata: row.metadata_ciphertext });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
