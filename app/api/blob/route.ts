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
        timestamp TIMESTAMP NOT NULL
      )
    `);
    inited = true;
  } finally {
    client.release();
  }
}

const ATPROTO_BACKUP_COLLECTION = "com.onecalendar.backup.blob";
const ATPROTO_BACKUP_RKEY = "latest";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const encrypted_data = body?.ciphertext;
    const iv = body?.iv;

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
        INSERT INTO calendar_backups (user_id, encrypted_data, iv, timestamp)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id)
        DO UPDATE SET
          encrypted_data = EXCLUDED.encrypted_data,
          iv = EXCLUDED.iv,
          timestamp = EXCLUDED.timestamp
        `,
        [user.id, encrypted_data, iv, new Date().toISOString()],
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
      `SELECT encrypted_data, iv, timestamp FROM calendar_backups WHERE user_id = $1`,
      [user.id],
    );
    if (result.rowCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      ciphertext: result.rows[0].encrypted_data,
      iv: result.rows[0].iv,
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
