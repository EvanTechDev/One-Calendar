import { NextResponse } from "next/server";
import { ensureTables, pool } from "@/lib/db";
import { requireSignedRequest } from "@/lib/signature";

export async function POST(request: Request) {
  const raw = await request.text();
  const client = await pool.connect();
  try {
    await ensureTables();
    const { did } = await requireSignedRequest(request, raw);
    const payload = JSON.parse(raw) as {
      backups: Array<{ encrypted_data: string; iv: string; timestamp: number }>;
      shares: Array<{ share_id: string; data: string; timestamp: number }>;
    };

    await client.query("BEGIN");
    await client.query("DELETE FROM calendar_backups WHERE user_id = $1", [did]);
    await client.query("DELETE FROM shares WHERE user_id = $1", [did]);

    for (const row of payload.backups || []) {
      await client.query(
        "INSERT INTO calendar_backups (user_id, encrypted_data, iv, timestamp) VALUES ($1, $2, $3, $4)",
        [did, row.encrypted_data, row.iv, row.timestamp],
      );
    }

    for (const row of payload.shares || []) {
      await client.query(
        "INSERT INTO shares (user_id, share_id, data, timestamp) VALUES ($1, $2, $3, $4)",
        [did, row.share_id, row.data, row.timestamp],
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  } finally {
    client.release();
  }
}
