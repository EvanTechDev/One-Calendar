import { type NextRequest, NextResponse } from 'next/server'
import { withEvlog, useLogger, getAuditActor } from '@/lib/evlog'
import { getServerSession } from '@/lib/auth/server'
import { db } from '@/lib/drizzle/client'
import { calendarBackups, shares } from '@/lib/drizzle/schema'
import { desc, eq } from 'drizzle-orm'
import { decryptServerJson } from '@/lib/server-crypto'

export const runtime = 'nodejs'

function eventContext(userId: string, eventId: string) {
  return `calendar-event:${userId}:${eventId}`
}

function eventTitle(row: {
  userId: string | null
  eventId: string | null
  title: string | null
  encryptedData: string | null
  iv: string | null
  authTag: string | null
}) {
  if (!row.userId || !row.eventId) return ''
  const decrypted = decryptServerJson<Record<string, unknown>>(
    row.encryptedData,
    row.iv,
    row.authTag,
    eventContext(row.userId, row.eventId),
    {},
  )
  return typeof decrypted.title === 'string'
    ? decrypted.title
    : (row.title ?? '')
}

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
      shareId: shares.shareId,
      eventId: shares.eventId,
      isProtected: shares.isProtected,
      isBurn: shares.isBurn,
      updatedAt: shares.updatedAt,
      title: calendarBackups.title,
      userId: calendarBackups.userId,
      encryptedData: calendarBackups.encryptedData,
      iv: calendarBackups.iv,
      authTag: calendarBackups.authTag,
    })
    .from(shares)
    .leftJoin(calendarBackups, eq(shares.eventId, calendarBackups.id))
    .where(eq(shares.userId, user.id))
    .orderBy(desc(shares.updatedAt))

  const shareList = result.map((row) => ({
    id: row.shareId,
    eventId: row.eventId ?? '',
    eventTitle: eventTitle(row),
    sharedBy: user.name,
    shareDate: row.updatedAt.toISOString(),
    shareLink: `/share/${row.shareId}`,
    isProtected: row.isProtected,
    burnAfterRead: row.isBurn,
  }))

  log.audit?.({
    action: 'share.list',
    actor: getAuditActor(log, { type: 'user', id: user.id, email: user.email }),
    target: { type: 'share_collection', id: user.id },
    outcome: 'success',
    reason: 'User listed link-based shares',
  })

  return NextResponse.json({ shares: shareList })
})
