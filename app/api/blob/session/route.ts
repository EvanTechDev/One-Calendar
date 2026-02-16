import { NextRequest, NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { Pool } from "pg"
import { createSessionToken } from "@/lib/session-jwt"
import { timingSafeEqual } from "crypto"

export const runtime = "nodejs"

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
})

let inited = false

async function initDB() {
  if (inited) return
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS calendar_backup_keys (
        user_id TEXT PRIMARY KEY,
        key_hash TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL
      )
    `)
    inited = true
  } finally {
    client.release()
  }
}

function isValidHash(keyHash: unknown): keyHash is string {
  return typeof keyHash === "string" && /^[a-f0-9]{64}$/i.test(keyHash)
}

function tokenFor(userId: string, keyHash: string) {
  const secret = process.env.BACKUP_JWT_SECRET
  if (!secret) throw new Error("BACKUP_JWT_SECRET is not configured")
  const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60
  return createSessionToken({ sub: userId, keyHash, exp }, secret)
}

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const action = body?.action
    const keyHash = body?.keyHash

    if (!isValidHash(keyHash)) {
      return NextResponse.json({ error: "Invalid key hash" }, { status: 400 })
    }

    await initDB()

    const client = await pool.connect()
    try {
      if (action === "register") {
        await client.query(
          `
            INSERT INTO calendar_backup_keys (user_id, key_hash, updated_at)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id)
            DO UPDATE SET key_hash = EXCLUDED.key_hash, updated_at = EXCLUDED.updated_at
          `,
          [user.id, keyHash, new Date().toISOString()],
        )
        return NextResponse.json({ token: tokenFor(user.id, keyHash) })
      }

      const result = await client.query(`SELECT key_hash FROM calendar_backup_keys WHERE user_id = $1`, [user.id])
      if (result.rowCount === 0) {
        return NextResponse.json({ error: "Encryption key not configured" }, { status: 404 })
      }

      const stored = result.rows[0].key_hash as string
      const storedBuffer = Buffer.from(stored)
      const inputBuffer = Buffer.from(keyHash)
      if (storedBuffer.length !== inputBuffer.length || !timingSafeEqual(storedBuffer, inputBuffer)) {
        return NextResponse.json({ error: "Invalid encryption key" }, { status: 403 })
      }

      return NextResponse.json({ token: tokenFor(user.id, keyHash) })
    } finally {
      client.release()
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 })
  }
}
