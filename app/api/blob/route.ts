
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
        ciphertext TEXT NOT NULL,
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
    const ciphertext = body?.ciphertext
    const iv = body?.iv
    if (typeof ciphertext !== "string" || typeof iv !== "string" || !ciphertext || !iv) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    if (!process.env.POSTGRES_URL) {
      return NextResponse.json({ error: "POSTGRES_URL missing" }, { status: 500 })
    }

    await initDB()

    const client = await pool.connect()
    try {
      await client.query(
        `
        INSERT INTO calendar_backups (user_id, ciphertext, iv, timestamp)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id)
        DO UPDATE SET
          ciphertext = EXCLUDED.ciphertext,
          iv = EXCLUDED.iv,
          timestamp = EXCLUDED.timestamp
        `,
        [user.id, ciphertext, iv, new Date().toISOString()],
      )
      return NextResponse.json({ success: true })
    } finally {
      client.release()
    }
  } catch (e: any) {
    console.error("POST /api/blob error:", e)
    return NextResponse.json(
      { error: e?.message || String(e) },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    const user = await currentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!process.env.POSTGRES_URL) {
      return NextResponse.json({ error: "POSTGRES_URL missing" }, { status: 500 })
    }

    await initDB()

    const client = await pool.connect()
    try {
      const result = await client.query(
        `SELECT ciphertext, iv, timestamp FROM calendar_backups WHERE user_id = $1`,
        [user.id],
      )
      if (result.rowCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json({
        success: true,
        ciphertext: result.rows[0].ciphertext,
        iv: result.rows[0].iv,
        timestamp: result.rows[0].timestamp,
      })
    } finally {
      client.release()
    }
  } catch (e: any) {
    console.error("GET /api/blob error:", e)
    return NextResponse.json(
      { error: e?.message || String(e) },
      { status: 500 },
    )
  }
}

export async function DELETE() {
  try {
    const user = await currentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!process.env.POSTGRES_URL) {
      return NextResponse.json({ error: "POSTGRES_URL missing" }, { status: 500 })
    }

    await initDB()

    const client = await pool.connect()
    try {
      await client.query(`DELETE FROM calendar_backups WHERE user_id = $1`, [user.id])
      return NextResponse.json({ success: true })
    } finally {
      client.release()
    }
  } catch (e: any) {
    console.error("DELETE /api/blob error:", e)
    return NextResponse.json(
      { error: e?.message || String(e) },
      { status: 500 },
    )
  }
}
