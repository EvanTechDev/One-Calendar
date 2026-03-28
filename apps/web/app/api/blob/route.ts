import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { Pool } from "pg";
import { getAtprotoSession } from "@/lib/atproto-auth";
import { deleteRecord, getRecord, putRecord } from "@/lib/atproto";
import { signedDsFetch } from "@/lib/ds-signed-request";

export const runtime = "nodejs";

const postgresUrl = process.env.POSTGRES_URL;
const useSsl =
  postgresUrl &&
  !/localhost|127\.0\.0\.1/.test(postgresUrl) &&
  !/sslmode=disable/.test(postgresUrl);

const pool = new Pool({
  connectionString: postgresUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

let inited = false;

async function initDB() {
  if (!postgresUrl) {
    throw new Error("POSTGRES_URL is not configured");
  }
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

const ATPROTO_BACKUP_COLLECTION = "app.onecalendar.backup";
const ATPROTO_BACKUP_RKEY = "latest";
const ATPROTO_DS_COLLECTION = "app.onecalendar.ds";
const ATPROTO_DS_RKEY = "self";

async function getDsEndpointFromAtproto() {
  const atproto = await getAtprotoSession();
  if (!atproto) return { atproto: null, ds: null as string | null };

  try {
    const dsRecord = await getRecord({
      pds: atproto.pds,
      repo: atproto.did,
      collection: ATPROTO_DS_COLLECTION,
      rkey: ATPROTO_DS_RKEY,
      accessToken: atproto.accessToken,
      dpopPrivateKeyPem: atproto.dpopPrivateKeyPem,
      dpopPublicJwk: atproto.dpopPublicJwk,
    });
    const ds = (dsRecord.value?.ds as string | undefined)?.trim() || null;
    return { atproto, ds };
  } catch {
    return { atproto, ds: null as string | null };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const encrypted_data = body?.ciphertext;
    const iv = body?.iv;

    if (typeof encrypted_data !== "string" || typeof iv !== "string") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { atproto, ds } = await getDsEndpointFromAtproto();
    if (atproto) {
      if (ds) {
        const dsRes = await signedDsFetch({
          session: atproto,
          ds,
          path: "/api/blob",
          method: "POST",
          body: {
            encrypted_data,
            iv,
            timestamp: Date.now(),
          },
        });

        if (!dsRes.ok) {
          const detail = await dsRes.text();
          return NextResponse.json(
            { error: `DS write failed: ${detail}` },
            { status: dsRes.status },
          );
        }
        return NextResponse.json({ success: true, backend: "ds", ds });
      }

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
  try {
    const { atproto, ds } = await getDsEndpointFromAtproto();
    if (atproto) {
      if (ds) {
        const dsRes = await signedDsFetch({
          session: atproto,
          ds,
          path: "/api/blob",
          method: "GET",
        });

        if (dsRes.status === 404) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (!dsRes.ok) {
          const detail = await dsRes.text();
          return NextResponse.json(
            { error: `DS read failed: ${detail}` },
            { status: dsRes.status },
          );
        }

        const payload = (await dsRes.json()) as {
          data?: { encrypted_data?: string; iv?: string; timestamp?: string };
        };
        const data = payload.data;
        if (!data) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        return NextResponse.json({
          ciphertext: data.encrypted_data,
          iv: data.iv,
          timestamp: data.timestamp,
          backend: "ds",
          ds,
        });
      }

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
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await initDB();

    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT encrypted_data, iv, timestamp FROM calendar_backups WHERE user_id = $1`,
        [user.id],
      );
      if (result.rowCount === 0)
        return NextResponse.json({ error: "Not found" }, { status: 404 });

      return NextResponse.json({
        ciphertext: result.rows[0].encrypted_data,
        iv: result.rows[0].iv,
        timestamp: result.rows[0].timestamp,
        backend: "postgres",
      });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { atproto, ds } = await getDsEndpointFromAtproto();
    if (atproto) {
      if (ds) {
        const dsRes = await signedDsFetch({
          session: atproto,
          ds,
          path: "/api/blob",
          method: "DELETE",
        });

        if (!dsRes.ok) {
          const detail = await dsRes.text();
          return NextResponse.json(
            { error: `DS delete failed: ${detail}` },
            { status: dsRes.status },
          );
        }

        return NextResponse.json({ success: true, backend: "ds", ds });
      }

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
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await initDB();

    const client = await pool.connect();
    try {
      await client.query(`DELETE FROM calendar_backups WHERE user_id = $1`, [
        user.id,
      ]);
      return NextResponse.json({ success: true, backend: "postgres" });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
