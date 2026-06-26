import { NextResponse } from 'next/server'
import { withEvlog, useLogger, getAuditActor } from '@/lib/evlog'
import { getServerSession } from '@/lib/auth/server'
import { db } from '@/lib/drizzle/client'
import { shares, calendarBackups } from '@/lib/drizzle/schema'
import { eq, sql } from 'drizzle-orm'

export const runtime = 'nodejs'

export const DELETE = withEvlog(async function DELETE(_request: Request) {
  try {
    const log = useLogger()
    const session = await getServerSession()
    const user = session?.user
    if (!user) {
      log.audit?.({
        action: 'account.delete',
        actor: getAuditActor(log),
        target: { type: 'account', id: 'unknown' },
        outcome: 'denied',
        reason: 'Authentication required',
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await db.transaction(async (tx) => {
      const hasCalendarEventsTable = await tx.execute(sql`
        SELECT 1 as ok FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'calendar_events' LIMIT 1
      `)

      if (hasCalendarEventsTable.length > 0) {
        await tx.execute(
          sql`DELETE FROM calendar_events WHERE user_id = ${user.id}`,
        )
      }

      await tx.delete(shares).where(eq(shares.userId, user.id))
      await tx
        .delete(calendarBackups)
        .where(eq(calendarBackups.userId, user.id))
    })

    log.audit?.({
      action: 'account.delete',
      actor: getAuditActor(log, {
        type: 'user',
        id: user.id,
        email: user.email,
      }),
      target: { type: 'account', id: user.id },
      outcome: 'success',
      reason: 'User requested account data deletion',
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal error' },
      { status: 500 },
    )
  }
})
