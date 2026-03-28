import { NextResponse } from "next/server";
import { ensureTables, pool } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ shareId: string }> }) {
  await ensureTables();
  const { shareId } = await params;
  const result = await pool.query(
    "SELECT user_id, share_id, data, timestamp FROM shares WHERE share_id = $1 LIMIT 1",
    [shareId],
  );
  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ share: result.rows[0] });
}
