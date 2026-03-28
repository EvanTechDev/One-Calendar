import { NextResponse } from "next/server";
import { ensureTables, pool } from "@/lib/db";
import { requireSignedRequest } from "@/lib/signature";

export async function POST(request: Request) {
  const raw = await request.text();
  try {
    await ensureTables();
    const { did } = await requireSignedRequest(request, raw);
    const [backups, shares] = await Promise.all([
      pool.query("SELECT encrypted_data, iv, timestamp FROM calendar_backups WHERE user_id = $1", [did]),
      pool.query("SELECT share_id, data, timestamp FROM shares WHERE user_id = $1", [did]),
    ]);

    return NextResponse.json({ did, backups: backups.rows, shares: shares.rows });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}
