import { type NextRequest, NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { Pool } from "pg"
import crypto from "crypto"
import { deleteRecord, getAtprotoSession, getRecordFromPds, putRecord, resolveAtprotoHandle } from "@/lib/atproto"

const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } })

async function initializeDatabase() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS shares (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        share_id VARCHAR(255) NOT NULL,
        encrypted_data TEXT NOT NULL,
        iv TEXT NOT NULL,
        auth_tag TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        is_protected BOOLEAN DEFAULT FALSE,
        is_burn BOOLEAN DEFAULT FALSE,
        enc_version INTEGER,
        UNIQUE(share_id)
      )
    `)
    await client.query(`ALTER TABLE shares ADD COLUMN IF NOT EXISTS user_id TEXT`)
    await client.query(`ALTER TABLE shares ADD COLUMN IF NOT EXISTS is_protected BOOLEAN DEFAULT FALSE`)
    await client.query(`ALTER TABLE shares ADD COLUMN IF NOT EXISTS is_burn BOOLEAN DEFAULT FALSE`)
    await client.query(`ALTER TABLE shares ADD COLUMN IF NOT EXISTS enc_version INTEGER`)
    await client.query(`UPDATE shares SET enc_version = 1 WHERE enc_version IS NULL`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_shares_user_id ON shares(user_id)`)
  } finally {
    client.release()
  }
}

const ALGORITHM = "aes-256-gcm"
const ATPROTO_SHARE_COLLECTION = "app.onecalendar.record.share"

function keyV2Unprotected(shareId: string) {
  return crypto.createHash("sha256").update(shareId, "utf8").digest()
}
function keyV3Password(password: string, shareId: string) {
  return crypto.scryptSync(password, shareId, 32)
}
function keyV1Legacy(shareId: string) {
  const salt = process.env.SALT
  if (!salt) throw new Error("SALT environment variable is not set")
  return crypto.scryptSync(shareId, salt, 32)
}

function encryptWithKey(data: string, key: Buffer) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(data, "utf8", "hex")
  encrypted += cipher.final("hex")
  const authTag = cipher.getAuthTag()
  return { encryptedData: encrypted, iv: iv.toString("hex"), authTag: authTag.toString("hex") }
}

function decryptWithKey(encryptedData: string, iv: string, authTag: string, key: Buffer): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, "hex"))
  decipher.setAuthTag(Buffer.from(authTag, "hex"))
  let decrypted = decipher.update(encryptedData, "hex", "utf8")
  decrypted += decipher.final("utf8")
  return decrypted
}

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser()
    const atproto = await getAtprotoSession()
    if (!user && !atproto) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id, data, password, burnAfterRead } = await request.json() as { id?: string; data?: any; password?: string; burnAfterRead?: boolean }
    if (!id || data === undefined || data === null) return NextResponse.json({ error: "Missing required fields" }, { status: 400 })

    const hasPassword = typeof password === "string" && password.length > 0
    const burn = !!burnAfterRead
    if (burn && !hasPassword) return NextResponse.json({ error: "burnAfterRead requires password protection" }, { status: 400 })

    const dataString = typeof data === "string" ? data : JSON.stringify(data)
    const encVersion = hasPassword ? 3 : 2
    const key = hasPassword ? keyV3Password(password as string, id) : keyV2Unprotected(id)
    const { encryptedData, iv, authTag } = encryptWithKey(dataString, key)

    if (atproto) {
      await putRecord(atproto, ATPROTO_SHARE_COLLECTION, id, {
        $type: ATPROTO_SHARE_COLLECTION,
        shareId: id,
        encryptedData,
        iv,
        authTag,
        timestamp: new Date().toISOString(),
        isProtected: hasPassword,
        isBurn: burn,
        encVersion,
      })
      return NextResponse.json({ success: true, id, protected: hasPassword, burnAfterRead: burn, link: `/${atproto.handle.replace(/^@/, "")}/${id}` })
    }

    await initializeDatabase()
    const client = await pool.connect()
    try {
      await client.query(`
        INSERT INTO shares (user_id, share_id, encrypted_data, iv, auth_tag, timestamp, is_protected, is_burn, enc_version)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (share_id) DO UPDATE SET
          encrypted_data = EXCLUDED.encrypted_data,
          iv = EXCLUDED.iv,
          auth_tag = EXCLUDED.auth_tag,
          timestamp = EXCLUDED.timestamp,
          is_protected = EXCLUDED.is_protected,
          is_burn = EXCLUDED.is_burn,
          enc_version = EXCLUDED.enc_version,
          user_id = EXCLUDED.user_id
      `, [user!.id, id, encryptedData, iv, authTag, new Date().toISOString(), hasPassword, burn, encVersion])
      return NextResponse.json({ success: true, id, protected: hasPassword, burnAfterRead: burn })
    } finally { client.release() }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error occurred" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")
  const password = request.nextUrl.searchParams.get("password") ?? ""
  const handle = request.nextUrl.searchParams.get("handle")
  if (!id) return NextResponse.json({ error: "Missing share ID" }, { status: 400 })

  try {
    if (handle) {
      const normalized = handle.replace(/^@/, "").toLowerCase()
      const { pds } = await resolveAtprotoHandle(normalized)
      const record = await getRecordFromPds(pds, normalized, ATPROTO_SHARE_COLLECTION, id)
      if (!record) return NextResponse.json({ error: "Share not found" }, { status: 404 })

      if (record.isProtected && !password) {
        return NextResponse.json({ error: "Password required", requiresPassword: true, burnAfterRead: record.isBurn }, { status: 401 })
      }

      const key = record.isProtected ? keyV3Password(password, id) : (record.encVersion === 1 ? keyV1Legacy(id) : keyV2Unprotected(id))
      let decryptedData: string
      try {
        decryptedData = decryptWithKey(record.encryptedData, record.iv, record.authTag, key)
      } catch {
        return NextResponse.json({ error: record.isProtected ? "Invalid password" : "Failed to decrypt share data." }, { status: 403 })
      }

      return NextResponse.json({ success: true, data: decryptedData, timestamp: record.timestamp, protected: record.isProtected, burnAfterRead: record.isBurn })
    }

    await initializeDatabase()
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const result = await client.query("SELECT encrypted_data, iv, auth_tag, timestamp, is_protected, is_burn, enc_version FROM shares WHERE share_id = $1 FOR UPDATE", [id])
      if (result.rows.length === 0) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "Share not found" }, { status: 404 })
      }
      const row = result.rows[0]
      if (row.is_protected && !password) {
        await client.query("COMMIT")
        return NextResponse.json({ error: "Password required", requiresPassword: true, burnAfterRead: row.is_burn }, { status: 401 })
      }
      const encVersion = row.enc_version ?? 1
      const key = row.is_protected ? keyV3Password(password, id) : (encVersion === 1 ? keyV1Legacy(id) : keyV2Unprotected(id))
      let decryptedData: string
      try {
        decryptedData = decryptWithKey(row.encrypted_data, row.iv, row.auth_tag, key)
      } catch {
        await client.query("COMMIT")
        return NextResponse.json({ error: row.is_protected ? "Invalid password" : "Failed to decrypt share data." }, { status: 403 })
      }
      if (row.is_burn) await client.query("DELETE FROM shares WHERE share_id = $1", [id])
      await client.query("COMMIT")
      return NextResponse.json({ success: true, data: decryptedData, timestamp: row.timestamp.toISOString(), protected: row.is_protected, burnAfterRead: row.is_burn })
    } catch (e) {
      try { await client.query("ROLLBACK") } catch {}
      throw e
    } finally { client.release() }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error occurred" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await currentUser()
    const atproto = await getAtprotoSession()
    if (!user && !atproto) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await request.json() as { id?: string }
    if (!id) return NextResponse.json({ error: "Missing share ID" }, { status: 400 })

    if (atproto) {
      await deleteRecord(atproto, ATPROTO_SHARE_COLLECTION, id)
      return NextResponse.json({ success: true })
    }

    await initializeDatabase()
    const client = await pool.connect()
    try {
      await client.query("DELETE FROM shares WHERE share_id = $1 AND user_id = $2", [id, user!.id])
      return NextResponse.json({ success: true })
    } finally { client.release() }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error occurred" }, { status: 500 })
  }
}
