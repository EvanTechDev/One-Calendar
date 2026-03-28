import { type NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { Pool } from "pg";
import crypto from "crypto";
import { deleteRecord, getRecord, putRecord } from "@/lib/atproto";
import { getAtprotoSession } from "@/lib/atproto-auth";
import { signedDsFetch } from "@/lib/ds-signed-request";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS shares (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        share_id VARCHAR(255) NOT NULL,
        encrypted_data TEXT NOT NULL,
        iv TEXT NOT NULL,
        auth_tag TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        is_protected BOOLEAN DEFAULT FALSE,
        is_burn BOOLEAN DEFAULT FALSE,
        enc_version INTEGER,
        UNIQUE(share_id)
      )
    `);
    await client.query(`ALTER TABLE shares ADD COLUMN IF NOT EXISTS user_id TEXT`);
    await client.query(`ALTER TABLE shares ADD COLUMN IF NOT EXISTS is_protected BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE shares ADD COLUMN IF NOT EXISTS is_burn BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE shares ADD COLUMN IF NOT EXISTS enc_version INTEGER`);
    await client.query(`UPDATE shares SET enc_version = 1 WHERE enc_version IS NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_shares_user_id ON shares(user_id)`);
  } finally {
    client.release();
  }
}

const ALGORITHM = "aes-256-gcm";
const ATPROTO_SHARE_COLLECTION = "app.onecalendar.share";
const ATPROTO_DS_COLLECTION = "app.onecalendar.ds";
const ATPROTO_DS_RKEY = "self";

async function getAtprotoDsSession() {
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

function keyV2Unprotected(shareId: string) {
  return crypto.createHash("sha256").update(shareId, "utf8").digest();
}

function keyV3Password(password: string, shareId: string) {
  return crypto.scryptSync(password, shareId, 32);
}

function encryptWithKey(data: string, key: Buffer): { encryptedData: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return { encryptedData: encrypted, iv: iv.toString("hex"), authTag: authTag.toString("hex") };
}

function decryptWithKey(encryptedData: string, iv: string, authTag: string, key: Buffer): string {
  const ivBuffer = Buffer.from(iv, "hex");
  const authTagBuffer = Buffer.from(authTag, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(authTagBuffer);
  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, data, password, burnAfterRead } = body as {
      id?: string;
      data?: unknown;
      password?: string;
      burnAfterRead?: boolean;
    };

    if (!id || data === undefined || data === null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const hasPassword = typeof password === "string" && password.length > 0;
    const burn = !!burnAfterRead;
    const dataString = typeof data === "string" ? data : JSON.stringify(data);
    const key = hasPassword ? keyV3Password(password as string, id) : keyV2Unprotected(id);
    const { encryptedData, iv, authTag } = encryptWithKey(dataString, key);

    const { atproto, ds } = await getAtprotoDsSession();
    if (atproto) {
      if (!ds) {
        return NextResponse.json(
          { error: "ATProto DS is not configured" },
          { status: 400 },
        );
      }

      const dsPayload = {
        encryptedData,
        iv,
        authTag,
        isProtected: hasPassword,
        isBurn: burn,
        timestamp: new Date().toISOString(),
      };

      const dsRes = await signedDsFetch({
        session: atproto,
        ds,
        path: "/api/share",
        method: "POST",
        body: {
          share_id: id,
          data: JSON.stringify(dsPayload),
          timestamp: Date.now(),
        },
      });
      if (!dsRes.ok) {
        const detail = await dsRes.text();
        return NextResponse.json(
          { error: `DS share write failed: ${detail}` },
          { status: dsRes.status },
        );
      }

      await putRecord({
        pds: atproto.pds,
        repo: atproto.did,
        collection: ATPROTO_SHARE_COLLECTION,
        rkey: id,
        accessToken: atproto.accessToken,
        dpopPrivateKeyPem: atproto.dpopPrivateKeyPem,
        dpopPublicJwk: atproto.dpopPublicJwk,
        record: {
          $type: ATPROTO_SHARE_COLLECTION,
          encryptedData,
          iv,
          authTag,
          isProtected: hasPassword,
          isBurn: burn,
          timestamp: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        success: true,
        id,
        protected: hasPassword,
        burnAfterRead: burn,
        shareLink: `/${atproto.handle}/${id}`,
      });
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await initializeDatabase();

    const client = await pool.connect();
    try {
      await client.query(
        `
        INSERT INTO shares (user_id, share_id, encrypted_data, iv, auth_tag, timestamp, is_protected, is_burn, enc_version)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (share_id)
        DO UPDATE SET encrypted_data = EXCLUDED.encrypted_data, iv = EXCLUDED.iv, auth_tag = EXCLUDED.auth_tag,
          timestamp = EXCLUDED.timestamp, is_protected = EXCLUDED.is_protected, is_burn = EXCLUDED.is_burn,
          enc_version = EXCLUDED.enc_version, user_id = EXCLUDED.user_id
        `,
        [user.id, id, encryptedData, iv, authTag, new Date().toISOString(), hasPassword, burn, hasPassword ? 3 : 2],
      );

      return NextResponse.json({ success: true, id, protected: hasPassword, burnAfterRead: burn, shareLink: `/share/${id}` });
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error occurred" }, { status: 500 });
  }
}

async function getAtprotoShare(id: string, password: string, handleParam?: string) {
  const { atproto, ds } = await getAtprotoDsSession();
  if (atproto) {
    if (!ds) {
      return NextResponse.json(
        { error: "ATProto DS is not configured" },
        { status: 400 },
      );
    }

    const dsRes = await signedDsFetch({
      session: atproto,
      ds,
      path: `/api/share/${encodeURIComponent(id)}`,
      method: "GET",
    });
    if (dsRes.status === 404) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }
    if (!dsRes.ok) {
      const detail = await dsRes.text();
      return NextResponse.json(
        { error: `DS share read failed: ${detail}` },
        { status: dsRes.status },
      );
    }

    const dsPayload = (await dsRes.json()) as { share?: { data?: string } };
    const dsShareRaw = dsPayload.share?.data;
    if (!dsShareRaw) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    const value = JSON.parse(dsShareRaw) as {
      encryptedData?: string;
      iv?: string;
      authTag?: string;
      isProtected?: boolean;
      isBurn?: boolean;
      timestamp?: string;
    };
    const isProtected = !!value.isProtected;
    if (isProtected && !password) {
      return NextResponse.json({ error: "Password required", requiresPassword: true, burnAfterRead: value.isBurn }, { status: 401 });
    }
    const key = isProtected ? keyV3Password(password, id) : keyV2Unprotected(id);
    const decryptedData = decryptWithKey(String(value.encryptedData), String(value.iv), String(value.authTag), key);

    if (value.isBurn) {
      await signedDsFetch({
        session: atproto,
        ds,
        path: "/api/share",
        method: "DELETE",
        body: { share_id: id },
      });
      await deleteRecord({ pds: atproto.pds, repo: atproto.did, collection: ATPROTO_SHARE_COLLECTION, rkey: id, accessToken: atproto.accessToken, dpopPrivateKeyPem: atproto.dpopPrivateKeyPem, dpopPublicJwk: atproto.dpopPublicJwk }).catch(() => undefined);
    }

    return NextResponse.json({ success: true, data: decryptedData, timestamp: value.timestamp, protected: isProtected, burnAfterRead: !!value.isBurn });
  }

  if (handleParam) {
    return NextResponse.json({ error: "Public atproto retrieval requires owner session support not configured" }, { status: 400 });
  }

  return null;
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const password = request.nextUrl.searchParams.get("password") ?? "";
  const handle = request.nextUrl.searchParams.get("handle") ?? undefined;

  if (!id) return NextResponse.json({ error: "Missing share ID" }, { status: 400 });

  try {
    const atprotoResult = await getAtprotoShare(id, password, handle);
    if (atprotoResult) return atprotoResult;

    await initializeDatabase();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        "SELECT encrypted_data, iv, auth_tag, timestamp, is_protected, is_burn FROM shares WHERE share_id = $1 FOR UPDATE",
        [id],
      );
      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Share not found" }, { status: 404 });
      }
      const row = result.rows[0];
      if (row.is_protected && !password) {
        await client.query("COMMIT");
        return NextResponse.json({ error: "Password required", requiresPassword: true, burnAfterRead: row.is_burn }, { status: 401 });
      }
      const key = row.is_protected ? keyV3Password(password, id) : keyV2Unprotected(id);
      let decryptedData: string;
      try {
        decryptedData = decryptWithKey(row.encrypted_data, row.iv, row.auth_tag, key);
      } catch {
        await client.query("COMMIT");
        return NextResponse.json({ error: row.is_protected ? "Invalid password" : "Failed to decrypt share data." }, { status: 403 });
      }
      if (row.is_burn) {
        await client.query("DELETE FROM shares WHERE share_id = $1", [id]);
      }
      await client.query("COMMIT");
      return NextResponse.json({ success: true, data: decryptedData, timestamp: row.timestamp.toISOString(), protected: row.is_protected, burnAfterRead: row.is_burn });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error occurred" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { id } = body as { id?: string };
  if (!id) return NextResponse.json({ error: "Missing share ID" }, { status: 400 });

  const { atproto, ds } = await getAtprotoDsSession();
  if (atproto) {
    if (!ds) {
      return NextResponse.json(
        { error: "ATProto DS is not configured" },
        { status: 400 },
      );
    }
    await signedDsFetch({
      session: atproto,
      ds,
      path: "/api/share",
      method: "DELETE",
      body: { share_id: id },
    });
    await deleteRecord({ pds: atproto.pds, repo: atproto.did, collection: ATPROTO_SHARE_COLLECTION, rkey: id, accessToken: atproto.accessToken, dpopPrivateKeyPem: atproto.dpopPrivateKeyPem, dpopPublicJwk: atproto.dpopPublicJwk });
    return NextResponse.json({ success: true });
  }

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initializeDatabase();
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM shares WHERE share_id = $1 AND user_id = $2", [id, user.id]);
    return NextResponse.json({ success: true });
  } finally {
    client.release();
  }
}
