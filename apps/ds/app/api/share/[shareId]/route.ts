import { NextResponse } from "next/server";
import { ensureTables, pool } from "@/lib/db";

export async function GET(request: Request, { params }: { params: Promise<{ shareId: string }> }) {
  const appToken = process.env.DS_APP_TOKEN;
  if (!appToken) {
    return NextResponse.json({ error: "DS_APP_TOKEN is not configured" }, { status: 500 });
  }
  // Allow DS data retrieval only from trusted web app server.
  if (request.headers.get("x-app-token") !== appToken) {
    return NextResponse.json({ error: "Invalid app token" }, { status: 401 });
  }
  await ensureTables();
  const { shareId } = await params;
  const result = await pool.query(
    "SELECT user_id, share_id, data, timestamp FROM shares WHERE share_id = $1 LIMIT 1",
    [shareId],
  );
  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ share: result.rows[0] });
}
