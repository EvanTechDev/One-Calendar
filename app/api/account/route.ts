import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth-server'
import { db } from '@/lib/drizzle/client'
import { shares, calendarBackups } from '@/lib/drizzle/schema'
import { eq, sql } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function DELETE() {
  try {
    const session = await getServerSession()
    const user = session?.user
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await db.transaction(async (tx) => {
      // Check if calendar_events table exists
      const hasCalendarEventsTable = await tx.execute(sql`
        SELECT 1 as ok FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'calendar_events' LIMIT 1
      `)
      
      if (hasCalendarEventsTable.length > 0) {
        await tx.execute(sql`DELETE FROM calendar_events WHERE user_id = ${user.id}`)
      }

      await tx.delete(shares).where(eq(shares.userId, user.id))
      await tx.delete(calendarBackups).where(eq(calendarBackups.userId, user.id))
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal error' },
      { status: 500 },
    )
  }
}
