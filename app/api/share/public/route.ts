import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Pool } from "pg";
import { getRecord, resolveHandle } from "@/lib/atproto";

const ALGORITHM = "aes-256-gcm";
const ATPROTO_SHARE_COLLECTION = "app.onecalendar.share.record";

const burnPool = process.env.POSTGRES_URL
  ? new Pool({
      connectionString: process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false },
    })
  : null;

let burnTableReady = false;

async function ensureBurnTable() {
  if (!burnPool || burnTableReady) return;
  const client = await burnPool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS atproto_share_burn_reads (
        handle TEXT NOT NULL,
        owner_did TEXT,
        share_id TEXT NOT NULL,
        burned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        pds_delete_synced BOOLEAN NOT NULL DEFAULT FALSE,
        PRIMARY KEY (share_id, handle)
      )
    `);
    await client.query(`ALTER TABLE atproto_share_burn_reads ADD COLUMN IF NOT EXISTS owner_did TEXT`);
    await client.query(`ALTER TABLE atproto_share_burn_reads ADD COLUMN IF NOT EXISTS pds_delete_synced BOOLEAN NOT NULL DEFAULT FALSE`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_atproto_share_burn_reads_owner_share ON atproto_share_burn_reads(owner_did, share_id) WHERE owner_did IS NOT NULL`);
    burnTableReady = true;
  } finally {
    client.release();
  }
}

async function wasPublicBurnConsumed(ownerDid: string, handle: string, shareId: string) {
  if (!burnPool) return false;
  await ensureBurnTable();
  const result = await burnPool.query(
    "SELECT 1 FROM atproto_share_burn_reads WHERE (owner_did = $1 OR (owner_did IS NULL AND handle = $2)) AND share_id = $3 LIMIT 1",
    [ownerDid, handle, shareId],
  );
  return result.rowCount > 0;
}

async function markPublicBurnConsumed(ownerDid: string, handle: string, shareId: string) {
  if (!burnPool) return;
  await ensureBurnTable();
  await burnPool.query(
    `
      INSERT INTO atproto_share_burn_reads (handle, owner_did, share_id, pds_delete_synced)
      VALUES ($1, $2, $3, FALSE)
      ON CONFLICT (share_id, handle)
      DO UPDATE SET owner_did = EXCLUDED.owner_did, pds_delete_synced = FALSE, burned_at = NOW()
    `,
    [handle, ownerDid, shareId],
  );
}

function keyV2Unprotected(shareId: string) {
  return crypto.createHash("sha256").update(shareId, "utf8").digest();
}

function keyV3Password(password: string, shareId: string) {
  return crypto.scryptSync(password, shareId, 32);
}

function decryptWithKey(encryptedData: string, iv: string, authTag: string, key: Buffer): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export async function GET(request: NextRequest) {
  const handle = request.nextUrl.searchParams.get("handle");
  const id = request.nextUrl.searchParams.get("id");
  const password = request.nextUrl.searchParams.get("password") ?? "";

  if (!handle || !id) return NextResponse.json({ error: "Missing handle or id" }, { status: 400 });

  const normalizedHandle = handle.replace(/^@/, "").toLowerCase();
  const resolved = await resolveHandle(normalizedHandle);
  const record = await getRecord({ pds: resolved.pds, repo: resolved.did, collection: ATPROTO_SHARE_COLLECTION, rkey: id });
  const value = record.value ?? {};
  const isProtected = !!value.isProtected;
  const isBurn = !!value.isBurn;

  if (isBurn && (await wasPublicBurnConsumed(resolved.did, normalizedHandle, id))) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }

  if (isProtected && !password) {
    return NextResponse.json({ error: "Password required", requiresPassword: true, burnAfterRead: isBurn }, { status: 401 });
  }

  const key = isProtected ? keyV3Password(password, id) : keyV2Unprotected(id);
  try {
    const decryptedData = decryptWithKey(String(value.encryptedData), String(value.iv), String(value.authTag), key);

    if (isBurn) {
      await markPublicBurnConsumed(resolved.did, normalizedHandle, id);
    }

    return NextResponse.json({ success: true, data: decryptedData, protected: isProtected, burnAfterRead: isBurn, timestamp: value.timestamp });
  } catch {
    return NextResponse.json({ error: isProtected ? "Invalid password" : "Failed to decrypt" }, { status: 403 });
  }
}
