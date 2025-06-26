import { type NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import crypto from "crypto";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
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
        UNIQUE(share_id)
      )
    `);
  } finally {
    client.release();
  }
}

function encryptData(data: string, shareId: string): { encryptedData: string; iv: string; authTag: string } {
  const salt = process.env.SALT;
  if (!salt) {
    throw new Error("SALT environment variable is not set");
  }
  
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(shareId, salt, 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encryptedData: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

function decryptData(encryptedData: string, iv: string, authTag: string, shareId: string): string {
  const salt = process.env.SALT;
  if (!salt) {
    throw new Error("SALT environment variable is not set");
  }
  
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(shareId, salt, 32);
  const ivBuffer = Buffer.from(iv, 'hex');
  const authTagBuffer = Buffer.from(authTag, 'hex');
  
  const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer);
  decipher.setAuthTag(authTagBuffer);
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export async function POST(request: NextRequest) {
  try {
    console.log('POSTGRES_URL:', process.env.POSTGRES_URL); // Debug log
    console.log('SSL Config:', { ssl: { rejectUnauthorized: false } }); // Debug log
    const body = await request.json();
    const { id, data } = body;
    if (!id || !data) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const POSTGRES_URL = process.env.POSTGRES_URL;
    if (!POSTGRES_URL) {
      throw new Error("POSTGRES_URL is not set");
    }

    await initializeDatabase();

    const dataString = typeof data === "string" ? data : JSON.stringify(data);
    const { encryptedData, iv, authTag } = encryptData(dataString, id);

    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO shares (share_id, encrypted_data, iv, auth_tag, timestamp)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (share_id)
        DO UPDATE SET
          encrypted_data = EXCLUDED.encrypted_data,
          iv = EXCLUDED.iv,
          auth_tag = EXCLUDED.auth_tag,
          timestamp = EXCLUDED.timestamp
      `, [id, encryptedData, iv, authTag, new Date().toISOString()]);

      return NextResponse.json({
        success: true,
        path: `shares/${id}/data.json`,
        id: id,
        message: "Share created successfully."
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Share API error:", error, error instanceof Error ? error.stack : '');
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
  try {
    console.log('POSTGRES_URL:', process.env.POSTGRES_URL); // Debug log
    console.log('SSL Config:', { ssl: { rejectUnauthorized: false } }); // Debug log
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing share ID" }, { status: 400 });
    }

    const POSTGRES_URL = process.env.POSTGRES_URL;
    if (!POSTGRES_URL) {
      throw new Error("POSTGRES_URL is not set");
    }

    await initializeDatabase();

    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT encrypted_data, iv, auth_tag, timestamp FROM shares WHERE share_id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: "Share not found" }, { status: 404 });
      }

      const { encrypted_data, iv, auth_tag, timestamp } = result.rows[0];

      try {
        const decryptedData = decryptData(encrypted_data, iv, auth_tag, id);
        return NextResponse.json({ 
          success: true, 
          data: decryptedData,
          timestamp: timestamp.toISOString()
        });
      } catch (decryptError) {
        console.error("Decryption error:", decryptError);
        if (decryptError instanceof Error) {
          if (decryptError.message.includes("bad decrypt") || decryptError.message.includes("wrong final block length")) {
            return NextResponse.json(
              { error: "Authentication failed: This share may have been tampered with or is invalid." },
              { status: 403 }
            );
          }
        }
        return NextResponse.json(
          { error: "Failed to decrypt share data. Please check the share ID." },
          { status: 403 }
        );
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Share API error:", error, error instanceof Error ? error.stack : '');
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
    console.log('POSTGRES_URL:', process.env.POSTGRES_URL); // Debug log
    console.log('SSL Config:', { ssl: { rejectUnauthorized: false } }); // Debug log
    const body = await request.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: "Missing share ID" }, { status: 400 });
    }

    const POSTGRES_URL = process.env.POSTGRES_URL;
    if (!POSTGRES_URL) {
      throw new Error("POSTGRES_URL is not set");
    }

    await initializeDatabase();

    const client = await pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM shares WHERE share_id = $1 RETURNING *',
        [id]
      );

      if (result.rowCount === 0) {
        return NextResponse.json({ 
          success: true, 
          message: `No share found with ID: ${id}, nothing to delete.` 
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
    console.error("Share API error:", error, error instanceof Error ? error.stack : '');
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
