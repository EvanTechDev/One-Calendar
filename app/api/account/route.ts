import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { eq, sql } from 'drizzle-orm'
import { db, schema } from '@/lib/db'

export const runtime = 'nodejs'

export async function DELETE() {
  try {
    const user = await currentUser()
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await db.transaction(async (tx) => {
      const hasCalendarEventsTable = await tx.execute(sql`
        SELECT 1 as ok FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'calendar_events' LIMIT 1
      `)
      if (hasCalendarEventsTable.rows.length > 0) {
        await tx.execute(
          sql`DELETE FROM calendar_events WHERE user_id = ${user.id}`,
        )
      }

      await tx.delete(schema.shares).where(eq(schema.shares.userId, user.id))
      await tx
        .delete(schema.calendarBackups)
        .where(eq(schema.calendarBackups.userId, user.id))
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal error' },
      { status: 500 },
    )
  }
}
