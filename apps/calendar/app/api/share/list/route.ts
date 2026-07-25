import { type NextRequest, NextResponse } from 'next/server'
import { withEvlog, useLogger, getAuditActor } from '@/lib/evlog'
import { getServerSession } from '@/lib/auth/server'
import { db } from '@/lib/drizzle/client'
import { shares, calendarEvents } from '@/lib/drizzle/schema'
import { eq, desc } from 'drizzle-orm'

export const runtime = 'nodejs'

export const GET = withEvlog(async function GET(_req: NextRequest) {
  const log = useLogger()
  const session = await getServerSession()
  const user = session?.user
  if (!user) {
    log.audit?.({
      action: 'share.list',
      actor: getAuditActor(log),
      target: { type: 'share_collection', id: 'unknown' },
      outcome: 'denied',
      reason: 'Authentication required',
    })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await db
    .select({
      id: shares.id,
      eventId: shares.eventId,
      hasPassword: shares.hasPassword,
      burnAfterRead: shares.burnAfterRead,
      createdAt: shares.createdAt,
      eventTitle: calendarEvents.title,
    })
    .from(shares)
    .innerJoin(calendarEvents, eq(shares.eventId, calendarEvents.id))
    .where(eq(shares.userId, user.id))
    .orderBy(desc(shares.createdAt))

  const shareList = result.map((row) => ({
    id: row.id,
    eventId: row.eventId,
    eventTitle: row.hasPassword ? '受保护' : (row.eventTitle ?? ''),
    sharedBy: user.id,
    shareDate: row.createdAt.toISOString(),
    shareLink: `/share/${row.id}`,
    isProtected: row.hasPassword,
  }))

  log.audit?.({
    action: 'share.list',
    actor: getAuditActor(log, {
      type: 'user',
      id: user.id,
      email: user.email,
    }),
    target: { type: 'share_collection', id: user.id },
    outcome: 'success',
    reason: 'User listed shares',
  })

  return NextResponse.json({ shares: shareList })
})
