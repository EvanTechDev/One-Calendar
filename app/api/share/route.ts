import { type NextRequest, NextResponse } from 'next/server'
import { withEvlog, useLogger, getAuditActor } from '@/lib/evlog'
import { getServerSession } from '@/lib/auth/server'
import { db } from '@/lib/drizzle/client'
import { calendarBackups, shares } from '@/lib/drizzle/schema'
import { and, eq } from 'drizzle-orm'
import { compare, hash } from 'bcryptjs'
import { randomUUID } from 'crypto'
import { decryptServerJson } from '@/lib/server-crypto'

export const runtime = 'nodejs'

function eventContext(userId: string, eventId: string) {
  return `calendar-event:${userId}:${eventId}`
}

function serializeEvent(row: typeof calendarBackups.$inferSelect) {
  const extra = decryptServerJson<Record<string, unknown>>(
    row.encryptedData,
    row.iv,
    row.authTag,
    eventContext(row.userId, row.id),
    {},
  )
  return {
    ...extra,
    id: row.id,
    title: row.title,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    isAllDay: row.isAllDay,
    recurrence: row.recurrence,
    color: row.color,
    calendarId: row.calendarId ?? '',
    sharedBy: row.userId,
  }
}

export const POST = withEvlog(async function POST(request: NextRequest) {
  try {
    const log = useLogger()
    const body = await request.json()
    const { id, eventId, data, password, burnAfterRead } = body as {
      id?: string
      eventId?: string
      data?: { id?: string }
      password?: string
      burnAfterRead?: boolean
    }
    const shareId = id || randomUUID()
    const targetEventId = eventId || data?.id
    if (!targetEventId) {
      return NextResponse.json({ error: 'Missing event ID' }, { status: 400 })
    }

    const session = await getServerSession()
    const user = session?.user
    if (!user) {
      log.audit?.({
        action: 'share.create',
        actor: getAuditActor(log),
        target: { type: 'share', id: shareId },
        outcome: 'denied',
        reason: 'Authentication required',
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [event] = await db
      .select({ id: calendarBackups.id })
      .from(calendarBackups)
      .where(
        and(
          eq(calendarBackups.id, targetEventId),
          eq(calendarBackups.userId, user.id),
        ),
      )
    if (!event)
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    const hasPassword = typeof password === 'string' && password.length > 0
    const now = new Date()
    await db
      .insert(shares)
      .values({
        userId: user.id,
        shareId,
        eventId: targetEventId,
        passwordHash: hasPassword ? await hash(password, 12) : null,
        isProtected: hasPassword,
        isBurn: Boolean(burnAfterRead),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: shares.shareId,
        set: {
          userId: user.id,
          eventId: targetEventId,
          passwordHash: hasPassword ? await hash(password, 12) : null,
          isProtected: hasPassword,
          isBurn: Boolean(burnAfterRead),
          updatedAt: now,
        },
      })

    log.audit?.({
      action: 'share.create',
      actor: getAuditActor(log, {
        type: 'user',
        id: user.id,
        email: user.email,
      }),
      target: { type: 'share', id: shareId },
      outcome: 'success',
      reason: 'User created link-based share',
    })

    return NextResponse.json({
      success: true,
      id: shareId,
      protected: hasPassword,
      burnAfterRead: Boolean(burnAfterRead),
      shareLink: `/share/${shareId}`,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 },
    )
  }
})

export const GET = withEvlog(async function GET(request: NextRequest) {
  const log = useLogger()
  const id = request.nextUrl.searchParams.get('id')
  const password = request.nextUrl.searchParams.get('password') ?? ''
  if (!id)
    return NextResponse.json({ error: 'Missing share ID' }, { status: 400 })

  try {
    const result = await db.transaction(async (tx) => {
      const [share] = await tx
        .select()
        .from(shares)
        .where(eq(shares.shareId, id))
      if (!share || !share.eventId) return { status: 404 as const }
      if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
        await tx.delete(shares).where(eq(shares.shareId, id))
        return { status: 404 as const }
      }
      if (share.isProtected) {
        if (!password)
          return { status: 401 as const, burnAfterRead: share.isBurn }
        if (
          !share.passwordHash ||
          !(await compare(password, share.passwordHash))
        ) {
          return { status: 403 as const, protected: true }
        }
      }

      const [event] = await tx
        .select()
        .from(calendarBackups)
        .where(
          and(
            eq(calendarBackups.id, share.eventId),
            eq(calendarBackups.userId, share.userId),
          ),
        )
      if (!event) return { status: 404 as const }
      if (share.isBurn) await tx.delete(shares).where(eq(shares.shareId, id))

      return {
        status: 200 as const,
        data: JSON.stringify(serializeEvent(event)),
        timestamp: share.updatedAt.toISOString(),
        protected: share.isProtected,
        burnAfterRead: share.isBurn,
      }
    })

    if (result.status === 404) {
      log.audit?.({
        action: 'share.export',
        actor: getAuditActor(log),
        target: { type: 'share', id },
        outcome: 'failure',
        reason: 'Share not found',
      })
      return NextResponse.json({ error: 'Share not found' }, { status: 404 })
    }
    if (result.status === 401) {
      return NextResponse.json(
        {
          error: 'Password required',
          requiresPassword: true,
          burnAfterRead: result.burnAfterRead,
        },
        { status: 401 },
      )
    }
    if (result.status === 403) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 403 })
    }

    log.audit?.({
      action: result.burnAfterRead ? 'share.burn_after_read' : 'share.export',
      actor: getAuditActor(log),
      target: { type: 'share', id },
      outcome: 'success',
      reason: 'Share exported through server-side decryption',
    })

    return NextResponse.json({
      success: true,
      data: result.data,
      timestamp: result.timestamp,
      protected: result.protected,
      burnAfterRead: result.burnAfterRead,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 },
    )
  }
})

export const DELETE = withEvlog(async function DELETE(request: NextRequest) {
  const log = useLogger()
  const body = await request.json()
  const { id } = body as { id?: string }
  if (!id)
    return NextResponse.json({ error: 'Missing share ID' }, { status: 400 })

  const session = await getServerSession()
  const user = session?.user
  if (!user) {
    log.audit?.({
      action: 'share.delete',
      actor: getAuditActor(log),
      target: { type: 'share', id },
      outcome: 'denied',
      reason: 'Authentication required',
    })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await db
    .delete(shares)
    .where(and(eq(shares.shareId, id), eq(shares.userId, user.id)))

  log.audit?.({
    action: 'share.delete',
    actor: getAuditActor(log, { type: 'user', id: user.id, email: user.email }),
    target: { type: 'share', id },
    outcome: 'success',
    reason: 'User deleted share',
  })

  return NextResponse.json({ success: true })
})
