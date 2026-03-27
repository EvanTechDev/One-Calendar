import { NextRequest, NextResponse } from "next/server";
import { initDsTables, dsPool } from "@/app/api/ds/_lib/db";
import { verifyDidSignedRequest } from "@/app/api/ds/_lib/auth";

export async function DELETE(request: NextRequest) {
  try {
    const verified = await verifyDidSignedRequest(request);
    await initDsTables();

    const client = await dsPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM shares WHERE did = $1", [verified.did]);
      await client.query("DELETE FROM calendar_data WHERE did = $1", [verified.did]);
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
