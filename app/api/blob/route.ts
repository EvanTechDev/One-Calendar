import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { Pool } from "pg";
import { getAtprotoSession } from "@/lib/atproto-auth";
import { deleteRecord, getRecord, putRecord } from "@/lib/atproto";

export const runtime = "nodejs";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

let inited = false;

async function initDB() {
  if (inited) return;
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS calendar_backups (
        user_id TEXT PRIMARY KEY,
        encrypted_data TEXT NOT NULL,
        iv TEXT NOT NULL,
        wrapped_data_key TEXT,
        key_version INTEGER DEFAULT 1,
        timestamp TIMESTAMP NOT NULL
      )
    `);
    await client.query(`ALTER TABLE calendar_backups ADD COLUMN IF NOT EXISTS wrapped_data_key TEXT`);
    await client.query(`ALTER TABLE calendar_backups ADD COLUMN IF NOT EXISTS key_version INTEGER DEFAULT 1`);
    inited = true;
  } finally {
    client.release();
  }
}

const ATPROTO_BACKUP_COLLECTION = "app.onecalendar.backup";
const ATPROTO_BACKUP_RKEY = "latest";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const encrypted_data = body?.ciphertext;
    const iv = body?.iv;
    const wrappedDataKey = body?.wrappedDataKey;
    const keyVersion = body?.keyVersion;

    if (typeof encrypted_data !== "string" || typeof iv !== "string") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const atproto = await getAtprotoSession();
    if (atproto) {
      await putRecord({
        pds: atproto.pds,
        repo: atproto.did,
        collection: ATPROTO_BACKUP_COLLECTION,
        rkey: ATPROTO_BACKUP_RKEY,
        accessToken: atproto.accessToken,
        dpopPrivateKeyPem: atproto.dpopPrivateKeyPem,
        dpopPublicJwk: atproto.dpopPublicJwk,
        record: {
          $type: ATPROTO_BACKUP_COLLECTION,
          ciphertext: encrypted_data,
          iv,
          wrappedDataKey: typeof wrappedDataKey === "string" ? wrappedDataKey : null,
          keyVersion: typeof keyVersion === "number" ? keyVersion : 1,
          updatedAt: new Date().toISOString(),
        },
      });
      return NextResponse.json({ success: true, backend: "atproto" });
    }

    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await initDB();

    const client = await pool.connect();
    try {
      await client.query(
        `
        INSERT INTO calendar_backups (user_id, encrypted_data, iv, wrapped_data_key, key_version, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id)
        DO UPDATE SET
          encrypted_data = EXCLUDED.encrypted_data,
          iv = EXCLUDED.iv,
          wrapped_data_key = EXCLUDED.wrapped_data_key,
          key_version = EXCLUDED.key_version,
          timestamp = EXCLUDED.timestamp
        `,
        [user.id, encrypted_data, iv, typeof wrappedDataKey === "string" ? wrappedDataKey : null, typeof keyVersion === "number" ? keyVersion : 1, new Date().toISOString()],
      );
      return NextResponse.json({ success: true, backend: "postgres" });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const atproto = await getAtprotoSession();
  if (atproto) {
    try {
      const record = await getRecord({
        pds: atproto.pds,
        repo: atproto.did,
        collection: ATPROTO_BACKUP_COLLECTION,
        rkey: ATPROTO_BACKUP_RKEY,
        accessToken: atproto.accessToken,
        dpopPrivateKeyPem: atproto.dpopPrivateKeyPem,
        dpopPublicJwk: atproto.dpopPublicJwk,
      });
      const value = record.value ?? {};
      return NextResponse.json({
        ciphertext: value.ciphertext,
        iv: value.iv,
        wrappedDataKey: value.wrappedDataKey ?? null,
        keyVersion: value.keyVersion ?? 1,
        timestamp: value.updatedAt,
        backend: "atproto",
      });
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initDB();

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT encrypted_data, iv, wrapped_data_key, key_version, timestamp FROM calendar_backups WHERE user_id = $1`,
      [user.id],
    );
    if (result.rowCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      ciphertext: result.rows[0].encrypted_data,
      iv: result.rows[0].iv,
      wrappedDataKey: result.rows[0].wrapped_data_key,
      keyVersion: result.rows[0].key_version ?? 1,
      timestamp: result.rows[0].timestamp,
      backend: "postgres",
    });
  } finally {
    client.release();
  }
}

export async function DELETE() {
  const atproto = await getAtprotoSession();
  if (atproto) {
    await deleteRecord({
      pds: atproto.pds,
      repo: atproto.did,
      collection: ATPROTO_BACKUP_COLLECTION,
      rkey: ATPROTO_BACKUP_RKEY,
      accessToken: atproto.accessToken,
      dpopPrivateKeyPem: atproto.dpopPrivateKeyPem,
      dpopPublicJwk: atproto.dpopPublicJwk,
    });
    return NextResponse.json({ success: true, backend: "atproto" });
  }

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initDB();

  const client = await pool.connect();
  try {
    await client.query(`DELETE FROM calendar_backups WHERE user_id = $1`, [user.id]);
    return NextResponse.json({ success: true, backend: "postgres" });
  } finally {
    client.release();
  }
}
