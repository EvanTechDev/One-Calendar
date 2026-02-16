
import { NextRequest, NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { Pool } from "pg"
import { decryptPayload } from "@/lib/crypto"
import { verifySessionToken } from "@/lib/session-jwt"

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
      CREATE TABLE IF NOT EXISTS calendar_backups (
        user_id TEXT PRIMARY KEY,
        encrypted_data TEXT NOT NULL,
        iv TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL
      )
    `)
    inited = true
  } finally {
    client.release()
  }
}

function getSessionSecret() {
  return process.env.BACKUP_JWT_SECRET
}

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (!auth?.startsWith("Bearer ")) return null
  return auth.slice(7).trim()
}

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const encrypted_data = body?.ciphertext
    const iv = body?.iv

    if (typeof encrypted_data !== "string" || typeof iv !== "string") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    await initDB()

    const client = await pool.connect()
    try {
      await client.query(
        `
        INSERT INTO calendar_backups (user_id, encrypted_data, iv, timestamp)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id)
        DO UPDATE SET
          encrypted_data = EXCLUDED.encrypted_data,
          iv = EXCLUDED.iv,
          timestamp = EXCLUDED.timestamp
        `,
        [user.id, encrypted_data, iv, new Date().toISOString()],
      )
      return NextResponse.json({ success: true })
    } finally {
      client.release()
    }
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await initDB()

  const client = await pool.connect()
  try {
    const result = await client.query(
      `SELECT encrypted_data, iv, timestamp FROM calendar_backups WHERE user_id = $1`,
      [user.id],
    )
    if (result.rowCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const row = result.rows[0]
    const token = getBearerToken(req)
    if (!token) {
      return NextResponse.json({
        ciphertext: row.encrypted_data,
        iv: row.iv,
        timestamp: row.timestamp,
      })
    }

    const secret = getSessionSecret()
    if (!secret) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
    }

    const payload = verifySessionToken(token, secret)
    if (!payload || payload.sub !== user.id) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 })
    }

    try {
      const plain = await decryptPayload(payload.keyHash, row.encrypted_data, row.iv)
      const data = JSON.parse(plain)
      return NextResponse.json({ data, timestamp: row.timestamp })
    } catch {
      return NextResponse.json({ error: "Unable to decrypt data with current token" }, { status: 403 })
    }
  } finally {
    client.release()
  }
}

export async function DELETE() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await initDB()

  const client = await pool.connect()
  try {
    await client.query(`DELETE FROM calendar_backups WHERE user_id = $1`, [user.id])
    return NextResponse.json({ success: true })
  } finally {
    client.release()
  }
}
