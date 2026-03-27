import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifyRequest } from "@/lib/auth";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { did, parsed } = await verifyRequest(request);
    await pool.query(
      `UPDATE calendar_data SET ciphertext = $1, iv = $2, auth_tag = $3, updated_at = NOW() WHERE id = $4 AND did = $5`,
      [String(parsed.ciphertext || ""), String(parsed.iv || ""), String(parsed.authTag || ""), id, did],
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "unauthorized" }, { status: 401 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { did } = await verifyRequest(request);
    await pool.query(`DELETE FROM calendar_data WHERE id = $1 AND did = $2`, [id, did]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "unauthorized" }, { status: 401 });
  }
}
