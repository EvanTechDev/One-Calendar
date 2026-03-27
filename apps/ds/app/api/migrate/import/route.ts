import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifyRequest } from "@/lib/auth";
import type { MigrateBundle } from "@onecalendar/types";

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const { did, parsed } = await verifyRequest(request);
    const payload = parsed as unknown as MigrateBundle;

    await client.query("BEGIN");

    for (const share of payload.shares || []) {
      await client.query(
        `INSERT INTO shares (id, did, ciphertext, iv, auth_tag, created_at)
         VALUES ($1,$2,$3,$4,$5,NOW())
         ON CONFLICT (id) DO UPDATE SET did = EXCLUDED.did, ciphertext = EXCLUDED.ciphertext, iv = EXCLUDED.iv, auth_tag = EXCLUDED.auth_tag`,
        [share.id, did, share.ciphertext, share.iv, share.authTag],
      );
    }

    for (const item of payload.calendarData || []) {
      await client.query(
        `INSERT INTO calendar_data (id, did, ciphertext, iv, auth_tag, updated_at)
         VALUES ($1,$2,$3,$4,$5,NOW())
         ON CONFLICT (id) DO UPDATE SET did = EXCLUDED.did, ciphertext = EXCLUDED.ciphertext, iv = EXCLUDED.iv, auth_tag = EXCLUDED.auth_tag, updated_at = NOW()`,
        [item.id, did, item.ciphertext, item.iv, item.authTag],
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error instanceof Error ? error.message : "unauthorized" }, { status: 401 });
  } finally {
    client.release();
  }
}
