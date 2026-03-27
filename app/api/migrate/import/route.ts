import { NextRequest, NextResponse } from "next/server";
import { initDsTables, dsPool } from "@/app/api/ds/_lib/db";
import { verifyDidSignedRequest } from "@/app/api/ds/_lib/auth";

type ImportShare = {
  share_id: string;
  plain_data?: string | null;
  encrypted_data?: string | null;
  iv?: string | null;
  auth_tag?: string | null;
  timestamp?: string;
  is_protected?: boolean;
  is_burn?: boolean;
  enc_version?: number | null;
};

export async function POST(request: NextRequest) {
  try {
    const verified = await verifyDidSignedRequest(request);
    await initDsTables();

    const body = verified.json as {
      shares?: ImportShare[];
      calendarData?: { ciphertext: string; iv: string; timestamp?: string } | null;
    };

    const shares = Array.isArray(body.shares) ? body.shares : [];

    const client = await dsPool.connect();
    try {
      await client.query("BEGIN");
      for (const share of shares) {
        await client.query(
          `INSERT INTO shares (did, share_id, plain_data, encrypted_data, iv, auth_tag, timestamp, is_protected, is_burn, enc_version)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (share_id)
           DO UPDATE SET did=EXCLUDED.did, plain_data=EXCLUDED.plain_data, encrypted_data=EXCLUDED.encrypted_data,
            iv=EXCLUDED.iv, auth_tag=EXCLUDED.auth_tag, timestamp=EXCLUDED.timestamp,
            is_protected=EXCLUDED.is_protected, is_burn=EXCLUDED.is_burn, enc_version=EXCLUDED.enc_version`,
          [
            verified.did,
            share.share_id,
            share.plain_data ?? null,
            share.encrypted_data ?? null,
            share.iv ?? null,
            share.auth_tag ?? null,
            share.timestamp || new Date().toISOString(),
            !!share.is_protected,
            !!share.is_burn,
            share.enc_version ?? null,
          ],
        );
      }

      if (body.calendarData?.ciphertext && body.calendarData?.iv) {
        await client.query(
          `INSERT INTO calendar_data (did, ciphertext, iv, timestamp)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (did)
           DO UPDATE SET ciphertext=EXCLUDED.ciphertext, iv=EXCLUDED.iv, timestamp=EXCLUDED.timestamp`,
          [verified.did, body.calendarData.ciphertext, body.calendarData.iv, body.calendarData.timestamp || new Date().toISOString()],
        );
      }

      await client.query("COMMIT");
      return NextResponse.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "unknown error" }, { status: 401 });
  }
}
