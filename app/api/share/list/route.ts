import { NextResponse } from "next/server"
import { Pool } from "pg"
import { currentUser } from "@clerk/nextjs/server"
import crypto from "crypto"
import { getAtprotoSession, listRecords } from "@/lib/atproto"

const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } })
const ALGORITHM = "aes-256-gcm"
const ATPROTO_SHARE_COLLECTION = "app.onecalendar.record.share"

function keyV2Unprotected(shareId: string) {
  return crypto.createHash("sha256").update(shareId, "utf8").digest()
}

function decryptWithKey(encryptedData: string, iv: string, authTag: string, key: Buffer) {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, "hex"))
  decipher.setAuthTag(Buffer.from(authTag, "hex"))
  let decrypted = decipher.update(encryptedData, "hex", "utf8")
  decrypted += decipher.final("utf8")
  return decrypted
}

export async function GET() {
  try {
    const user = await currentUser()
    const atproto = await getAtprotoSession()
    if (!user && !atproto) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (atproto) {
      const records = await listRecords(atproto, ATPROTO_SHARE_COLLECTION)
      const shares = records.map((record) => {
        const value = record.value || {}
        let eventId = ""
        let eventTitle = ""
        if (!value.isProtected) {
          try {
            const decrypted = decryptWithKey(value.encryptedData, value.iv, value.authTag, keyV2Unprotected(value.shareId))
            const dataObj = JSON.parse(decrypted)
            eventId = dataObj.id ?? ""
            eventTitle = dataObj.title ?? ""
          } catch {}
        } else {
          eventId = "受保护"
          eventTitle = "受保护"
        }
        return {
          id: value.shareId,
          eventId,
          eventTitle,
          sharedBy: atproto.handle,
          shareDate: value.timestamp,
          shareLink: `/${atproto.handle.replace(/^@/, "")}/${value.shareId}`,
          isProtected: !!value.isProtected,
        }
      })
      return NextResponse.json({ shares })
    }

    const client = await pool.connect()
    try {
      const result = await client.query(
        `SELECT share_id, encrypted_data, iv, auth_tag, timestamp, is_protected
         FROM shares
         WHERE user_id = $1
         ORDER BY timestamp DESC`,
        [user!.id],
      )

      const shares = result.rows.map((row) => {
        let eventId = ""
        let eventTitle = ""
        if (!row.is_protected) {
          try {
            const decrypted = decryptWithKey(row.encrypted_data, row.iv, row.auth_tag, keyV2Unprotected(row.share_id))
            const dataObj = JSON.parse(decrypted)
            eventId = dataObj.id ?? ""
            eventTitle = dataObj.title ?? ""
          } catch {}
        } else {
          eventId = "受保护"
          eventTitle = "受保护"
        }
        return {
          id: row.share_id,
          eventId,
          eventTitle,
          sharedBy: user!.id,
          shareDate: row.timestamp.toISOString(),
          shareLink: `/share/${row.share_id}`,
          isProtected: row.is_protected,
        }
      })

      return NextResponse.json({ shares })
    } finally {
      client.release()
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
