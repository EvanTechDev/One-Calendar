import { NextResponse } from "next/server";
import { Pool } from "pg";
import { currentUser } from "@clerk/nextjs/server";
import crypto from "crypto";
import { getAtprotoSession } from "@/lib/atproto-auth";
import { listRecords } from "@/lib/atproto";

const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const ALGORITHM = "aes-256-gcm";
const ATPROTO_SHARE_COLLECTION = "com.onecalendar.share.record";

function keyV2Unprotected(shareId: string) {
  return crypto.createHash("sha256").update(shareId, "utf8").digest();
}

function decryptWithKey(encryptedData: string, iv: string, authTag: string, key: Buffer) {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export async function GET() {
  const atproto = await getAtprotoSession();
  if (atproto) {
    const data = await listRecords({ pds: atproto.pds, repo: atproto.did, collection: ATPROTO_SHARE_COLLECTION, accessToken: atproto.accessToken, dpopPrivateKeyPem: atproto.dpopPrivateKeyPem, dpopPublicJwk: atproto.dpopPublicJwk });
    const shares = (data.records || []).map((record) => {
      const rkey = record.uri.split("/").pop() || "";
      const value = record.value ?? {};
      let eventId = "";
      let eventTitle = "";
      if (!value.isProtected) {
        try {
          const decrypted = decryptWithKey(String(value.encryptedData), String(value.iv), String(value.authTag), keyV2Unprotected(rkey));
          const parsed = JSON.parse(decrypted) as { id?: string; title?: string };
          eventId = parsed.id || "";
          eventTitle = parsed.title || "";
        } catch {
          eventTitle = "";
        }
      }
      return {
        id: rkey,
        eventId,
        eventTitle: value.isProtected ? "Protected" : eventTitle,
        sharedBy: atproto.handle,
        shareDate: String(value.timestamp || new Date().toISOString()),
        shareLink: `/${atproto.handle}/${rkey}`,
        isProtected: !!value.isProtected,
      };
    });

    return NextResponse.json({ shares });
  }

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT share_id, encrypted_data, iv, auth_tag, timestamp, is_protected FROM shares WHERE user_id = $1 ORDER BY timestamp DESC`,
      [user.id],
    );

    const shares = result.rows.map((row) => {
      let eventId = "";
      let eventTitle = "";
      if (!row.is_protected) {
        try {
          const decrypted = decryptWithKey(row.encrypted_data, row.iv, row.auth_tag, keyV2Unprotected(row.share_id));
          const dataObj = JSON.parse(decrypted);
          eventId = dataObj.id ?? "";
          eventTitle = dataObj.title ?? "";
        } catch {}
      } else {
        eventId = "受保护";
        eventTitle = "受保护";
      }
      return {
        id: row.share_id,
        eventId,
        eventTitle,
        sharedBy: user.id,
        shareDate: row.timestamp.toISOString(),
        shareLink: `/share/${row.share_id}`,
        isProtected: row.is_protected,
      };
    });

    return NextResponse.json({ shares });
  } finally {
    client.release();
  }
}
