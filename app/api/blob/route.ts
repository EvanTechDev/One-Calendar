import { NextRequest, NextResponse } from 'next/server'
import { withEvlog, useLogger, getAuditActor } from '@/lib/evlog'
import { getServerSession } from '@/lib/auth/server'
import { db } from '@/lib/drizzle/client'
import { calendarBackups } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...NO_STORE_HEADERS, ...init?.headers },
  })
}

export const POST = withEvlog(async function POST(req: NextRequest) {
  try {
    const log = useLogger()
    const [session, body] = await Promise.all([getServerSession(), req.json()])
    const user = session?.user
    const userId = user?.id

    if (!userId) {
      log.audit?.({
        action: 'calendar_backup.upsert',
        actor: getAuditActor(log),
        target: { type: 'calendar_backup', id: 'unknown' },
        outcome: 'denied',
        reason: 'Authentication required',
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const encrypted_data = body?.ciphertext
    const iv = body?.iv

    if (typeof encrypted_data !== 'string' || typeof iv !== 'string')
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

    await db
      .insert(calendarBackups)
      .values({
        userId,
        encryptedData: encrypted_data,
        iv,
        timestamp: new Date(),
      })
      .onConflictDoUpdate({
        target: calendarBackups.userId,
        set: { encryptedData: encrypted_data, iv, timestamp: new Date() },
      })

    log.audit?.({
      action: 'calendar_backup.upsert',
      actor: getAuditActor(log, {
        type: 'user',
        id: userId,
        ...(user?.email ? { email: user.email } : {}),
      }),
      target: { type: 'calendar_backup', id: userId },
      outcome: 'success',
      reason: 'User saved encrypted calendar backup',
    })
    return NextResponse.json({ success: true, backend: 'postgres' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

export const GET = withEvlog(async function GET(_req: NextRequest) {
  try {
    const log = useLogger()
    const session = await getServerSession()
    const user = session?.user
    const userId = user?.id

    if (!userId) {
      log.audit?.({
        action: 'calendar_backup.export',
        actor: getAuditActor(log),
        target: { type: 'calendar_backup', id: 'unknown' },
        outcome: 'denied',
        reason: 'Authentication required',
      })
      return jsonNoStore({ error: 'Unauthorized' }, { status: 401 })
    }

    const [result] = await db
      .select({
        encryptedData: calendarBackups.encryptedData,
        iv: calendarBackups.iv,
        timestamp: calendarBackups.timestamp,
      })
      .from(calendarBackups)
      .where(eq(calendarBackups.userId, userId))

    if (!result) {
      log.audit?.({
        action: 'calendar_backup.export',
        actor: getAuditActor(log, {
          type: 'user',
          id: userId,
          ...(user?.email ? { email: user.email } : {}),
        }),
        target: { type: 'calendar_backup', id: userId },
        outcome: 'failure',
        reason: 'No encrypted calendar backup found',
      })
      return jsonNoStore({ error: 'Not found' }, { status: 404 })
    }

    log.audit?.({
      action: 'calendar_backup.export',
      actor: getAuditActor(log, {
        type: 'user',
        id: userId,
        ...(user?.email ? { email: user.email } : {}),
      }),
      target: { type: 'calendar_backup', id: userId },
      outcome: 'success',
      reason: 'User exported encrypted calendar backup',
    })

    return jsonNoStore({
      ciphertext: result.encryptedData,
      iv: result.iv,
      timestamp: result.timestamp,
      backend: 'postgres',
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error'
    return jsonNoStore({ error: message }, { status: 500 })
  }
})

export const DELETE = withEvlog(async function DELETE(_req: NextRequest) {
  try {
    const log = useLogger()
    const session = await getServerSession()
    const user = session?.user
    const userId = user?.id

    if (!userId) {
      log.audit?.({
        action: 'calendar_backup.delete',
        actor: getAuditActor(log),
        target: { type: 'calendar_backup', id: 'unknown' },
        outcome: 'denied',
        reason: 'Authentication required',
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await db.delete(calendarBackups).where(eq(calendarBackups.userId, userId))

    log.audit?.({
      action: 'calendar_backup.delete',
      actor: getAuditActor(log, {
        type: 'user',
        id: userId,
        ...(user?.email ? { email: user.email } : {}),
      }),
      target: { type: 'calendar_backup', id: userId },
      outcome: 'success',
      reason: 'User deleted encrypted calendar backup',
    })

    return NextResponse.json({ success: true, backend: 'postgres' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
