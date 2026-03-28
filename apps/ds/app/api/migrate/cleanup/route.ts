import { NextResponse } from "next/server";
import { ensureTables, pool } from "@/lib/db";
import { requireSignedRequest } from "@/lib/signature";

export async function POST(request: Request) {
  const raw = await request.text();
  const client = await pool.connect();
  try {
    await ensureTables();
    const { did } = await requireSignedRequest(request, raw);

    await client.query("BEGIN");
    await client.query("DELETE FROM shares WHERE user_id = $1", [did]);
    await client.query("DELETE FROM calendar_backups WHERE user_id = $1", [did]);
    await client.query("COMMIT");

    return NextResponse.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  } finally {
    client.release();
  }
}
