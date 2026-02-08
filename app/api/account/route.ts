import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { Pool } from "pg"

export const runtime = "nodejs"

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
})

export async function DELETE() {
  try {
    const user = await currentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const client = await pool.connect()
    try {
      await client.query("BEGIN")

      const hasCalendarEventsTable = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'calendar_events' LIMIT 1`,
      )
      if (hasCalendarEventsTable.rowCount) {
        await client.query(`DELETE FROM calendar_events WHERE user_id = $1`, [user.id])
      }

      const hasSharesTable = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shares' LIMIT 1`,
      )
      if (hasSharesTable.rowCount) {
        await client.query(`DELETE FROM shares WHERE user_id = $1`, [user.id])
      }

      const hasBackupsTable = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'calendar_backups' LIMIT 1`,
      )
      if (hasBackupsTable.rowCount) {
        await client.query(`DELETE FROM calendar_backups WHERE user_id = $1`, [user.id])
      }

      await client.query("COMMIT")
      return NextResponse.json({ success: true })
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 })
  }
}
