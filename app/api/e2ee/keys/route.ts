import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import type { WrappedDataKeyPayload } from "@/lib/e2ee/types";

export const runtime = "nodejs";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

let initialized = false;

async function ensureSchema() {
  if (initialized) return;
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_e2ee_keys (
        user_id TEXT PRIMARY KEY,
        wrapped_data_key TEXT NOT NULL,
        key_version INT NOT NULL,
        updated_at TIMESTAMP NOT NULL
      )
    `);
    initialized = true;
  } finally {
    client.release();
  }
}

function parsePayload(body: unknown): WrappedDataKeyPayload | null {
  if (!body || typeof body !== "object") return null;
  const payload = body as Partial<WrappedDataKeyPayload>;
  if (payload.alg !== "AES-GCM") return null;
  if (typeof payload.ciphertext !== "string" || typeof payload.iv !== "string") return null;
  if (typeof payload.keyVersion !== "number") return null;
  return payload as WrappedDataKeyPayload;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureSchema();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT wrapped_data_key, key_version, updated_at FROM user_e2ee_keys WHERE user_id = $1`,
      [user.id],
    );

    if (result.rowCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const wrappedDataKey = JSON.parse(result.rows[0].wrapped_data_key) as WrappedDataKeyPayload;
    return NextResponse.json({
      userId: user.id,
      wrappedDataKey,
      keyVersion: result.rows[0].key_version,
      updatedAt: result.rows[0].updated_at,
    });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const payload = parsePayload(body);
  if (!payload) return NextResponse.json({ error: "Invalid wrapped data key payload" }, { status: 400 });

  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query(
      `
      INSERT INTO user_e2ee_keys (user_id, wrapped_data_key, key_version, updated_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id)
      DO UPDATE SET wrapped_data_key = EXCLUDED.wrapped_data_key, key_version = EXCLUDED.key_version, updated_at = EXCLUDED.updated_at
      `,
      [user.id, JSON.stringify(payload), payload.keyVersion, new Date().toISOString()],
    );
    return NextResponse.json({ success: true, keyVersion: payload.keyVersion });
  } finally {
    client.release();
  }
}
