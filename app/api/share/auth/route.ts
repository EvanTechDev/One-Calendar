import { NextRequest, NextResponse } from "next/server";
import {
  createShareAccessToken,
  decryptWithKey,
  initializeShareDatabase,
  isValidSha256Hex,
  keyV3Password,
  withShareClient,
} from "@/lib/server/share-security";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, passwordHash } = body as { id?: string; passwordHash?: string };

    if (!id || !passwordHash) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!isValidSha256Hex(passwordHash)) {
      return NextResponse.json({ error: "Invalid hash format" }, { status: 400 });
    }

    await initializeShareDatabase();

    return await withShareClient(async (client) => {
      const result = await client.query(
        "SELECT encrypted_data, iv, auth_tag, is_protected FROM shares WHERE share_id = $1",
        [id],
      );

      if (!result.rows.length) {
        return NextResponse.json({ error: "Share not found" }, { status: 404 });
      }

      const row = result.rows[0] as {
        encrypted_data: string;
        iv: string;
        auth_tag: string;
        is_protected: boolean;
      };

      if (!row.is_protected) {
        return NextResponse.json({ error: "Share is not password protected" }, { status: 400 });
      }

      try {
        decryptWithKey(row.encrypted_data, row.iv, row.auth_tag, keyV3Password(passwordHash, id));
      } catch {
        return NextResponse.json({ error: "Invalid key hash" }, { status: 403 });
      }

      const token = createShareAccessToken(id, passwordHash);
      return NextResponse.json({ success: true, token, expiresIn: 60 * 60 * 24 });
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
