import { NextResponse } from "next/server";
import { ensureTables, pool } from "@/lib/db";
import { requireSignedRequest } from "@/lib/signature";

export async function POST(request: Request) {
  const raw = await request.text();
  try {
    await ensureTables();
    const { did } = await requireSignedRequest(request, raw);
    const payload = JSON.parse(raw) as {
      share_id: string;
      data: string;
      timestamp?: number;
    };

    await pool.query(
      `INSERT INTO shares (user_id, share_id, data, timestamp)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, share_id) DO UPDATE SET data = EXCLUDED.data, timestamp = EXCLUDED.timestamp`,
      [did, payload.share_id, payload.data, payload.timestamp ?? Date.now()],
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}

export async function DELETE(request: Request) {
  const raw = await request.text();
  try {
    await ensureTables();
    const { did } = await requireSignedRequest(request, raw);
    const payload = JSON.parse(raw) as { share_id: string };
    await pool.query("DELETE FROM shares WHERE user_id = $1 AND share_id = $2", [
      did,
      payload.share_id,
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}
