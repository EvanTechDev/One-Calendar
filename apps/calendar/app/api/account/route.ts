import { NextResponse } from 'next/server'
import { withEvlog, useLogger, getAuditActor } from '@/lib/evlog'
import { getServerSession } from '@/lib/auth/server'
import { getDb } from '@/lib/drizzle/client'
import {
  user as userTable,
  session as sessionTable,
  account as accountTable,
  twoFactor as twoFactorTable,
  calendarEvents,
  settings,
  calendarCategories,
  countdowns,
  bookmarkedEvents,
} from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'

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

    await getDb().transaction(async (tx) => {
      await tx
        .delete(bookmarkedEvents)
        .where(eq(bookmarkedEvents.userId, user.id))
      await tx.delete(countdowns).where(eq(countdowns.userId, user.id))
      await tx
        .delete(calendarCategories)
        .where(eq(calendarCategories.userId, user.id))
      await tx.delete(settings).where(eq(settings.userId, user.id))
      await tx.delete(calendarEvents).where(eq(calendarEvents.userId, user.id))
      await tx.delete(sessionTable).where(eq(sessionTable.userId, user.id))
      await tx.delete(accountTable).where(eq(accountTable.userId, user.id))
      await tx.delete(twoFactorTable).where(eq(twoFactorTable.userId, user.id))
      await tx.delete(userTable).where(eq(userTable.id, user.id))
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
