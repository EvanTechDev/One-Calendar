import { type NextRequest, NextResponse } from 'next/server'
import { withEvlog, useLogger, getAuditActor } from '@/lib/evlog'
import { getServerSession } from '@/lib/auth/server'
import { db } from '@/lib/drizzle/client'
import { calendarBackups, shares } from '@/lib/drizzle/schema'
import { desc, eq, and } from 'drizzle-orm'
import { decryptServerJson } from '@/lib/server-crypto'

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
    .select()
    .from(shares)
    .where(eq(shares.userId, user.id))
    .orderBy(desc(shares.timestamp))

  const shareList = await Promise.all(
    result.map(async (row) => {
      let eventTitle = row.isProtected ? '受保护' : ''
      try {
        const [eventRow] = await db
          .select()
          .from(calendarBackups)
          .where(
            and(
              eq(calendarBackups.userId, user.id),
              eq(calendarBackups.id, row.eventId),
            ),
          )
        if (eventRow && !row.isProtected) {
          const event = decryptServerJson<any>(
            eventRow.encryptedData,
            eventRow.iv,
            eventRow.authTag,
            'calendar-event',
          )
          eventTitle = event?.title ?? ''
        }
      } catch {}
      return {
        id: row.shareId,
        eventId: row.eventId,
        eventTitle,
        sharedBy: user.id,
        shareDate: row.timestamp.toISOString(),
        shareLink: `/share/${row.shareId}`,
        isProtected: row.isProtected,
      }
    }),
  )

  return NextResponse.json({ shares: shareList })
})
