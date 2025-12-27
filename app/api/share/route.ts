import { type NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import crypto from "crypto";

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
    await client.query(`ALTER TABLE shares ADD COLUMN IF NOT EXISTS is_protected BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE shares ADD COLUMN IF NOT EXISTS is_burn BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE shares ADD COLUMN IF NOT EXISTS enc_version INTEGER`);
    await client.query(`UPDATE shares SET enc_version = 1 WHERE enc_version IS NULL`);
  } finally {
    client.release();
  }
}

const ALGORITHM = "aes-256-gcm";

function keyV2Unprotected(shareId: string) {
  return crypto.createHash("sha256").update(shareId, "utf8").digest();
}

function keyV3Password(password: string, shareId: string) {
  return crypto.scryptSync(password, shareId, 32);
}

function keyV1Legacy(shareId: string) {
  const salt = process.env.SALT;
  if (!salt) throw new Error("SALT environment variable is not set");
  return crypto.scryptSync(shareId, salt, 32);
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
      data?: any;
      password?: string;
      burnAfterRead?: boolean;
    };

    if (!id || data === undefined || data === null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const hasPassword = typeof password === "string" && password.length > 0;
    const burn = !!burnAfterRead;

    if (burn && !hasPassword) {
      return NextResponse.json({ error: "burnAfterRead requires password protection" }, { status: 400 });
    }

    const POSTGRES_URL = process.env.POSTGRES_URL;
    if (!POSTGRES_URL) throw new Error("POSTGRES_URL is not set");

    await initializeDatabase();

    const dataString = typeof data === "string" ? data : JSON.stringify(data);
    const encVersion = hasPassword ? 3 : 2;
    const key = hasPassword ? keyV3Password(password as string, id) : keyV2Unprotected(id);
    const { encryptedData, iv, authTag } = encryptWithKey(dataString, key);

    const client = await pool.connect();
    try {
      await client.query(
        `
        INSERT INTO shares (share_id, encrypted_data, iv, auth_tag, timestamp, is_protected, is_burn, enc_version)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (share_id)
        DO UPDATE SET
          encrypted_data = EXCLUDED.encrypted_data,
          iv = EXCLUDED.iv,
          auth_tag = EXCLUDED.auth_tag,
          timestamp = EXCLUDED.timestamp,
          is_protected = EXCLUDED.is_protected,
          is_burn = EXCLUDED.is_burn,
          enc_version = EXCLUDED.enc_version
        `,
        [id, encryptedData, iv, authTag, new Date().toISOString(), hasPassword, burn, encVersion]
      );

      return NextResponse.json({
        success: true,
        path: `shares/${id}/data.json`,
        id,
        message: "Share created successfully.",
        protected: hasPassword,
        burnAfterRead: burn,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const password = request.nextUrl.searchParams.get("password") ?? "";

  if (!id) {
    return NextResponse.json({ error: "Missing share ID" }, { status: 400 });
  }

  try {
    const POSTGRES_URL = process.env.POSTGRES_URL;
    if (!POSTGRES_URL) throw new Error("POSTGRES_URL is not set");

    await initializeDatabase();

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        "SELECT encrypted_data, iv, auth_tag, timestamp, is_protected, is_burn, enc_version FROM shares WHERE share_id = $1 FOR UPDATE",
        [id]
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Share not found" }, { status: 404 });
      }

      const row = result.rows[0] as {
        encrypted_data: string;
        iv: string;
        auth_tag: string;
        timestamp: Date;
        is_protected: boolean;
        is_burn: boolean;
        enc_version: number | null;
      };

      if (row.is_protected && !password) {
        await client.query("COMMIT");
        return NextResponse.json(
          { error: "Password required", requiresPassword: true, burnAfterRead: row.is_burn },
          { status: 401 }
        );
      }

      const encVersion = row.enc_version ?? 1;

      let key: Buffer;
      if (row.is_protected) {
        key = keyV3Password(password, id);
      } else {
        key = encVersion === 1 ? keyV1Legacy(id) : keyV2Unprotected(id);
      }

      let decryptedData: string;
      try {
        decryptedData = decryptWithKey(row.encrypted_data, row.iv, row.auth_tag, key);
      } catch {
        await client.query("COMMIT");
        if (row.is_protected) return NextResponse.json({ error: "Invalid password" }, { status: 403 });
        return NextResponse.json({ error: "Failed to decrypt share data." }, { status: 403 });
      }

      if (row.is_burn) {
        await client.query("DELETE FROM shares WHERE share_id = $1", [id]);
      }

      await client.query("COMMIT");

      return NextResponse.json({
        success: true,
        data: decryptedData,
        timestamp: row.timestamp.toISOString(),
        protected: row.is_protected,
        burnAfterRead: row.is_burn,
      });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body as { id?: string };

    if (!id) {
      return NextResponse.json({ error: "Missing share ID" }, { status: 400 });
    }

    const POSTGRES_URL = process.env.POSTGRES_URL;
    if (!POSTGRES_URL) throw new Error("POSTGRES_URL is not set");

    await initializeDatabase();

    const client = await pool.connect();
    try {
      const result = await client.query("DELETE FROM shares WHERE share_id = $1 RETURNING *", [id]);

      if (result.rowCount === 0) {
        return NextResponse.json({
          success: true,
          message: `No share found with ID: ${id}, nothing to delete.`,
        });
      }

      return NextResponse.json({
        success: true,
        message: `Successfully deleted share with ID: ${id}`,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
``
