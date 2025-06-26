import { type NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import crypto from "crypto";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRE_URL,
});

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS calendar_backups (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        encrypted_data TEXT NOT NULL,
        iv TEXT NOT NULL,
        auth_tag TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        UNIQUE(user_id)
      )
    `);
  } finally {
    client.release();
  }
}

function encryptData(data: string, userId: string): { encryptedData: string; iv: string; authTag: string } {
  const salt = process.env.SALT;
  if (!salt) {
    throw new Error("SALT environment variable is not set");
  }
  
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(userId, salt, 32);
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

function decryptData(encryptedData: string, iv: string, authTag: string, userId: string): string {
  const salt = process.env.SALT;
  if (!salt) {
    throw new Error("SALT environment variable is not set");
  }
  
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(userId, salt, 32);
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
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized: User not authenticated" }, { status: 401 });
    }
    const userId = user.id;

    const POSTGRE_URL = process.env.POSTGRE_URL;
    if (!POSTGRE_URL) {
      throw new Error("POSTGRE_URL is not set");
    }

    await initializeDatabase();

    const body = await request.json();
    const { data } = body;
    if (!data) {
      return NextResponse.json({ error: "Missing required field: 'data' is required" }, { status: 400 });
    }

    const dataString = typeof data === "string" ? data : JSON.stringify(data);
    const { encryptedData, iv, authTag } = encryptData(dataString, userId);

    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO calendar_backups (user_id, encrypted_data, iv, auth_tag, timestamp)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id)
        DO UPDATE SET
          encrypted_data = EXCLUDED.encrypted_data,
          iv = EXCLUDED.iv,
          auth_tag = EXCLUDED.auth_tag,
          timestamp = EXCLUDED.timestamp
      `, [userId, encryptedData, iv, authTag, new Date().toISOString()]);

      return NextResponse.json({
        success: true,
        userId: userId,
        message: "Encrypted backup created successfully"
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Backup API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized: User not authenticated" }, { status: 401 });
    }
    const userId = user.id;

    const POSTGRE_URL = process.env.POSTGRE_URL;
    if (!POSTGRE_URL) {
      throw new Error("POSTGRE_URL is not set");
    }

    await initializeDatabase();

    const client = await pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM calendar_backups WHERE user_id = $1 RETURNING *',
        [userId]
      );

      if (result.rowCount === 0) {
        return NextResponse.json({ error: "User backup not found" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: "User backup deleted successfully",
        userId: userId
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Delete API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized: User not authenticated" }, { status: 401 });
    }
    const userId = user.id;

    const POSTGRE_URL = process.env.POSTGRE_URL;
    if (!POSTGRE_URL) {
      throw new Error("POSTGRE_URL is not set");
    }

    await initializeDatabase();

    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT encrypted_data, iv, auth_tag, timestamp FROM calendar_backups WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: "Backup not found" }, { status: 404 });
      }

      const { encrypted_data, iv, auth_tag, timestamp } = result.rows[0];

      try {
        const decryptedData = decryptData(encrypted_data, iv, auth_tag, userId);
        
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
              { error: "Authentication failed: This backup may belong to a different user or the data has been tampered with." },
              { status: 403 }
            );
          }
        }
        
        return NextResponse.json(
          { error: "Failed to decrypt backup data. Please check if this backup belongs to your account." },
          { status: 403 }
        );
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Restore API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
