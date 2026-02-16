import { NextRequest, NextResponse } from "next/server";
import {
  decryptWithKey,
  initializeShareDatabase,
  keyV3Password,
  verifyShareAccessToken,
  withShareClient,
} from "@/lib/server/share-security";

function getBearerToken(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const token = getBearerToken(request);

  if (!id) {
    return NextResponse.json({ error: "Missing share ID" }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  try {
    const payload = verifyShareAccessToken(token);
    if (!payload || payload.sid !== id) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    await initializeShareDatabase();

    return await withShareClient(async (client) => {
      await client.query("BEGIN");

      try {
        const result = await client.query(
          "SELECT encrypted_data, iv, auth_tag, timestamp, is_protected, is_burn FROM shares WHERE share_id = $1 FOR UPDATE",
          [id],
        );

        if (!result.rows.length) {
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
        };

        if (!row.is_protected) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "Share is not password protected" }, { status: 400 });
        }

        let decryptedData: string;
        try {
          decryptedData = decryptWithKey(row.encrypted_data, row.iv, row.auth_tag, keyV3Password(payload.ph, id));
        } catch {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "Token no longer valid for share" }, { status: 401 });
        }

        if (row.is_burn) {
          await client.query("DELETE FROM shares WHERE share_id = $1", [id]);
        }

        await client.query("COMMIT");

        return NextResponse.json({
          success: true,
          data: decryptedData,
          timestamp: row.timestamp.toISOString(),
          protected: true,
          burnAfterRead: row.is_burn,
        });
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    );
  }
}
