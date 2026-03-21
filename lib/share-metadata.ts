import crypto from "crypto";
import { Pool } from "pg";

const pool = process.env.POSTGRES_URL
  ? new Pool({
      connectionString: process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false },
    })
  : null;

const ALGORITHM = "aes-256-gcm";

function keyV2Unprotected(shareId: string) {
  return crypto.createHash("sha256").update(shareId, "utf8").digest();
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

export async function getShareTitleForMetadata(shareId: string): Promise<string | null> {
  if (!pool) return null;

  const result = await pool.query(
    "SELECT encrypted_data, iv, auth_tag, is_protected FROM shares WHERE share_id = $1 LIMIT 1",
    [shareId],
  );

  if (!result.rows.length) return null;

  const row = result.rows[0];
  if (row.is_protected) return null;

  try {
    const decrypted = decryptWithKey(
      row.encrypted_data,
      row.iv,
      row.auth_tag,
      keyV2Unprotected(shareId),
    );
    const event = typeof decrypted === "string" ? JSON.parse(decrypted) : decrypted;
    return typeof event?.title === "string" && event.title.trim() ? event.title : null;
  } catch {
    return null;
  }
}
