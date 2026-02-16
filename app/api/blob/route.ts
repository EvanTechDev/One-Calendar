
import { NextRequest, NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { Pool } from "pg"

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

export async function GET() {
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
    return NextResponse.json({
      ciphertext: row.encrypted_data,
      iv: row.iv,
      timestamp: row.timestamp,
    })
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
