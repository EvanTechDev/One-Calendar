import { NextRequest, NextResponse } from "next/server";
import { initDsTables, dsPool } from "@/app/api/ds/_lib/db";
import { verifyDidSignedRequest } from "@/app/api/ds/_lib/auth";

export async function GET(request: NextRequest) {
  try {
    const verified = await verifyDidSignedRequest(request);
    await initDsTables();

    const client = await dsPool.connect();
    try {
      const shares = await client.query(
        `SELECT share_id, plain_data, encrypted_data, iv, auth_tag, timestamp, is_protected, is_burn, enc_version
         FROM shares WHERE did = $1 ORDER BY timestamp DESC`,
        [verified.did],
      );

      const calendarData = await client.query(
        `SELECT ciphertext, iv, timestamp FROM calendar_data WHERE did = $1 LIMIT 1`,
        [verified.did],
      );

      return NextResponse.json({
        did: verified.did,
        shares: shares.rows,
        calendarData: calendarData.rows[0] || null,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "unknown error" }, { status: 401 });
  }
}
