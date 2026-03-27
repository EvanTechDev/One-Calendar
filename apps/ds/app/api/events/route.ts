import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifyRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { did } = await verifyRequest(request);
    const shares = await pool.query(
      `SELECT id, did, ciphertext, iv, auth_tag as "authTag", created_at as "createdAt" FROM shares WHERE did = $1 ORDER BY created_at DESC`,
      [did],
    );
    const calendarData = await pool.query(
      `SELECT id, did, ciphertext, iv, auth_tag as "authTag", updated_at as "updatedAt" FROM calendar_data WHERE did = $1 ORDER BY updated_at DESC`,
      [did],
    );
    return NextResponse.json({ shares: shares.rows, calendarData: calendarData.rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { did, parsed } = await verifyRequest(request);
    const id = String(parsed.id || crypto.randomUUID());
    const ciphertext = String(parsed.ciphertext || "");
    const iv = String(parsed.iv || "");
    const authTag = String(parsed.authTag || "");

    await pool.query(
      `INSERT INTO calendar_data (id, did, ciphertext, iv, auth_tag, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW())
       ON CONFLICT (id) DO UPDATE SET did = EXCLUDED.did, ciphertext = EXCLUDED.ciphertext, iv = EXCLUDED.iv, auth_tag = EXCLUDED.auth_tag, updated_at = NOW()`,
      [id, did, ciphertext, iv, authTag],
    );

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "unauthorized" }, { status: 401 });
  }
}
