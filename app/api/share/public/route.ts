import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getRecord, resolveHandle } from "@/lib/atproto";

const ALGORITHM = "aes-256-gcm";
const ATPROTO_SHARE_COLLECTION = "com.onecalendar.share.record";

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

  const resolved = await resolveHandle(handle);
  const record = await getRecord({ pds: resolved.pds, repo: resolved.did, collection: ATPROTO_SHARE_COLLECTION, rkey: id });
  const value = record.value ?? {};
  const isProtected = !!value.isProtected;

  if (isProtected && !password) {
    return NextResponse.json({ error: "Password required", requiresPassword: true, burnAfterRead: !!value.isBurn }, { status: 401 });
  }

  const key = isProtected ? keyV3Password(password, id) : keyV2Unprotected(id);
  try {
    const decryptedData = decryptWithKey(String(value.encryptedData), String(value.iv), String(value.authTag), key);
    return NextResponse.json({ success: true, data: decryptedData, protected: isProtected, burnAfterRead: !!value.isBurn, timestamp: value.timestamp });
  } catch {
    return NextResponse.json({ error: isProtected ? "Invalid password" : "Failed to decrypt" }, { status: 403 });
  }
}
