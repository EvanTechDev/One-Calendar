import { type NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import {
  decryptWithKey,
  encryptWithKey,
  initializeShareDatabase,
  isValidSha256Hex,
  keyV1Legacy,
  keyV2Unprotected,
  keyV3Password,
  withShareClient,
} from "@/lib/server/share-security";

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, data, password, burnAfterRead } = body as {
      id?: string;
      data?: unknown;
      password?: string;
      burnAfterRead?: boolean;
    };

    if (!id || data === undefined || data === null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const hasPassword = typeof password === "string" && password.length > 0;
    const burn = !!burnAfterRead;

    if (hasPassword && !isValidSha256Hex(password)) {
      return NextResponse.json({ error: "Password must be SHA-256 hash" }, { status: 400 });
    }

    if (burn && !hasPassword) {
      return NextResponse.json({ error: "burnAfterRead requires password protection" }, { status: 400 });
    }

    if (!process.env.POSTGRES_URL) throw new Error("POSTGRES_URL is not set");

    await initializeShareDatabase();

    const dataString = typeof data === "string" ? data : JSON.stringify(data);
    const encVersion = hasPassword ? 3 : 2;
    const key = hasPassword ? keyV3Password(password as string, id) : keyV2Unprotected(id);
    const { encryptedData, iv, authTag } = encryptWithKey(dataString, key);

    await withShareClient(async (client) => {
      await client.query(
        `
        INSERT INTO shares (user_id, share_id, encrypted_data, iv, auth_tag, timestamp, is_protected, is_burn, enc_version)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (share_id)
        DO UPDATE SET
          encrypted_data = EXCLUDED.encrypted_data,
          iv = EXCLUDED.iv,
          auth_tag = EXCLUDED.auth_tag,
          timestamp = EXCLUDED.timestamp,
          is_protected = EXCLUDED.is_protected,
          is_burn = EXCLUDED.is_burn,
          enc_version = EXCLUDED.enc_version,
          user_id = EXCLUDED.user_id
        `,
        [user.id, id, encryptedData, iv, authTag, new Date().toISOString(), hasPassword, burn, encVersion],
      );
    });

    return NextResponse.json({
      success: true,
      path: `shares/${id}/data.json`,
      id,
      message: "Share created successfully.",
      protected: hasPassword,
      burnAfterRead: burn,
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

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing share ID" }, { status: 400 });
  }

  try {
    if (!process.env.POSTGRES_URL) throw new Error("POSTGRES_URL is not set");

    await initializeShareDatabase();

    return await withShareClient(async (client) => {
      await client.query("BEGIN");

      try {
        const result = await client.query(
          "SELECT encrypted_data, iv, auth_tag, timestamp, is_protected, is_burn, enc_version FROM shares WHERE share_id = $1 FOR UPDATE",
          [id],
        );

        if (result.rows.length === 0) {
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
          enc_version: number | null;
        };

        if (row.is_protected) {
          await client.query("COMMIT");
          return NextResponse.json(
            { error: "Password required", requiresPassword: true, burnAfterRead: row.is_burn },
            { status: 401 },
          );
        }

        const encVersion = row.enc_version ?? 1;
        const key = encVersion === 1 ? keyV1Legacy(id) : keyV2Unprotected(id);

        let decryptedData: string;
        try {
          decryptedData = decryptWithKey(row.encrypted_data, row.iv, row.auth_tag, key);
        } catch {
          await client.query("COMMIT");
          if (row.is_protected) return NextResponse.json({ error: "Invalid password" }, { status: 403 });
          return NextResponse.json({ error: "Failed to decrypt share data." }, { status: 403 });
        }

        if (row.is_burn) {
          await client.query("DELETE FROM shares WHERE share_id = $1", [id]);
        }

        await client.query("COMMIT");

        return NextResponse.json({
          success: true,
          data: decryptedData,
          timestamp: row.timestamp.toISOString(),
          protected: row.is_protected,
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

export async function DELETE(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body as { id?: string };

    if (!id) {
      return NextResponse.json({ error: "Missing share ID" }, { status: 400 });
    }

    if (!process.env.POSTGRES_URL) throw new Error("POSTGRES_URL is not set");

    await initializeShareDatabase();

    return await withShareClient(async (client) => {
      const result = await client.query("DELETE FROM shares WHERE share_id = $1 AND user_id = $2 RETURNING *", [id, user.id]);

      if (result.rowCount === 0) {
        return NextResponse.json({
          success: true,
          message: `No share found with ID: ${id}, nothing to delete.`,
        });
      }

      return NextResponse.json({
        success: true,
        message: `Successfully deleted share with ID: ${id}`,
      });
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
