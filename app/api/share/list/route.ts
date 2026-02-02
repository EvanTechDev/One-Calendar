import { NextResponse } from "next/server";
import { Pool } from "pg";
import { currentUser } from "@clerk/nextjs/server";
import crypto from "crypto";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const ALGORITHM = "aes-256-gcm";

function keyV2Unprotected(shareId: string) {
  return crypto.createHash("sha256").update(shareId, "utf8").digest();
}

function decryptWithKey(encryptedData: string, iv: string, authTag: string, key: Buffer) {
  const ivBuffer = Buffer.from(iv, "hex");
  const authTagBuffer = Buffer.from(authTag, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(authTagBuffer);
  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = user.id;

    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT share_id, encrypted_data, iv, auth_tag, timestamp, is_protected
         FROM shares
         WHERE user_id = $1
         ORDER BY timestamp DESC`,
        [userId]
      );

      const shares = await Promise.all(
        result.rows.map(async (row) => {
          let eventId = "";
          let eventTitle = "";

          if (!row.is_protected) {
            try {
              const key = keyV2Unprotected(row.share_id);
              const decrypted = decryptWithKey(row.encrypted_data, row.iv, row.auth_tag, key);
              const dataObj = JSON.parse(decrypted);
              eventId = dataObj.id ?? "";
              eventTitle = dataObj.title ?? "";
            } catch {
              eventId = "";
              eventTitle = "";
            }
          } else {
            eventId = "受保护";
            eventTitle = "受保护";
          }

          return {
            id: row.share_id,
            eventId,
            eventTitle,
            sharedBy: userId,
            shareDate: row.timestamp.toISOString(),
            shareLink: `/share/${row.share_id}`,
            isProtected: row.is_protected,
          };
        })
      );

      return NextResponse.json({ shares });
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
