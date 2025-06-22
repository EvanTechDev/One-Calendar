import { type NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import crypto from "crypto";

interface Env {
  BACKUP_DB: D1Database;
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

export async function POST(request: NextRequest, { env }: { env: Env }) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized: User not authenticated" }, { status: 401 });
    }
    const userId = user.id;

    const body = await request.json();
    const { data } = body;
    if (!data) {
      return NextResponse.json({ error: "Missing required field: 'data' is required" }, { status: 400 });
    }

    const dataString = typeof data === "string" ? data : JSON.stringify(data);
    
    const { encryptedData, iv, authTag } = encryptData(dataString, userId);
    
    await env.BACKUP_DB.run(
      "INSERT OR REPLACE INTO backups (user_id, encrypted_data, iv, auth_tag) VALUES (?, ?, ?, ?)",
      [userId, encryptedData, iv, authTag]
    );
    
    return NextResponse.json({
      success: true,
      userId: userId,
      message: "Encrypted backup created successfully"
    });
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

export async function DELETE(request: NextRequest, { env }: { env: Env }) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized: User not authenticated" }, { status: 401 });
    }
    const userId = user.id;

    const result = await env.BACKUP_DB.run("DELETE FROM backups WHERE user_id = ?", [userId]);
    
    if (result.meta.changes === 0) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "User backup deleted successfully",
      userId: userId
    });
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

export async function GET(request: NextRequest, { env }: { env: Env }) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized: User not authenticated" }, { status: 401 });
    }
    const userId = user.id;

    const row = await env.BACKUP_DB.get(
      "SELECT encrypted_data, iv, auth_tag, timestamp FROM backups WHERE user_id = ?",
      [userId]
    );
    
    if (!row) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    const { encrypted_data, iv, auth_tag, timestamp } = row as any;

    try {
      const decryptedData = decryptData(encrypted_data, iv, auth_tag, userId);
      
      return NextResponse.json({ 
        success: true, 
        data: decryptedData,
        timestamp 
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
