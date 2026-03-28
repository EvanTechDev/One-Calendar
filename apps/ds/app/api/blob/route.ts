import { NextResponse } from "next/server";
import { ensureTables, pool } from "@/lib/db";
import { requireSignedRequest } from "@/lib/signature";

function statusForError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  if (
    message.includes("Missing signature headers") ||
    message.includes("Expired timestamp") ||
    message.includes("Invalid signature") ||
    message.includes("Failed to resolve DID") ||
    message.includes("Missing DID public key")
  ) {
    return 401;
  }
  return 500;
}

export async function GET(request: Request) {
  try {
    await ensureTables();
    const { did } = await requireSignedRequest(request);
    const result = await pool.query(
      "SELECT encrypted_data, iv, timestamp FROM calendar_backups WHERE user_id = $1 LIMIT 1",
      [did],
    );
    return NextResponse.json({ data: result.rows[0] ?? null });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: statusForError(error) },
    );
  }
}

export async function POST(request: Request) {
  const raw = await request.text();
  try {
    await ensureTables();
    const { did } = await requireSignedRequest(request, raw);
    const payload = JSON.parse(raw) as {
      encrypted_data: string;
      iv: string;
      timestamp?: number;
    };

    await pool.query(
      `INSERT INTO calendar_backups (user_id, encrypted_data, iv, timestamp)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET encrypted_data = EXCLUDED.encrypted_data, iv = EXCLUDED.iv, timestamp = EXCLUDED.timestamp, updated_at = NOW()`,
      [did, payload.encrypted_data, payload.iv, payload.timestamp ?? Date.now()],
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: statusForError(error) },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureTables();
    const { did } = await requireSignedRequest(request);
    await pool.query("DELETE FROM calendar_backups WHERE user_id = $1", [did]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: statusForError(error) },
    );
  }
}
