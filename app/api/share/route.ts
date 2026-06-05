import { type NextRequest, NextResponse } from 'next/server'
import { withEvlog, useLogger, getAuditActor } from '@/lib/evlog'
import { getServerSession } from '@/lib/auth/server'
import { db } from '@/lib/drizzle/client'
import { calendarBackups, shares } from '@/lib/drizzle/schema'
import { and, eq } from 'drizzle-orm'
import {
  decryptServerJson,
  decryptSharePassword,
  encryptServerJson,
  encryptSharePassword,
} from '@/lib/server-crypto'

export const runtime = 'nodejs'

export const POST = withEvlog(async function POST(request: NextRequest) {
  try {
    const log = useLogger()
    const body = await request.json()
    const { id, data, password, burnAfterRead } = body as {
      id?: string
      data?: any
      password?: string
      burnAfterRead?: boolean
    }
    const eventId = String(data?.id || body?.eventId || '')
    if (!id || !eventId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      )
    }

    const session = await getServerSession()
    const user = session?.user
    if (!user) {
      log.audit?.({
        action: 'share.create',
        actor: getAuditActor(log),
        target: { type: 'share', id },
        outcome: 'denied',
        reason: 'Authentication required',
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPassword = typeof password === 'string' && password.length > 0
    const encrypted = hasPassword
      ? encryptSharePassword(password as string, id)
      : encryptServerJson({ unprotected: true }, `share:${id}`)
    const now = new Date()

    await db
      .insert(shares)
      .values({
        userId: user.id,
        shareId: id,
        eventId,
        encryptedData: encrypted.encryptedData,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        timestamp: now,
        isProtected: hasPassword,
        isBurn: Boolean(burnAfterRead),
        encVersion: hasPassword ? 4 : 4,
      })
      .onConflictDoUpdate({
        target: shares.shareId,
        set: {
          userId: user.id,
          eventId,
          encryptedData: encrypted.encryptedData,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          timestamp: now,
          isProtected: hasPassword,
          isBurn: Boolean(burnAfterRead),
          encVersion: 4,
        },
      })

    return NextResponse.json({
      success: true,
      id,
      protected: hasPassword,
      burnAfterRead: Boolean(burnAfterRead),
      shareLink: `/share/${id}`,
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
      if (!share) return { status: 404 as const }
      if (share.isProtected) {
        if (!password)
          return { status: 401 as const, burnAfterRead: share.isBurn }
        const expectedPassword = decryptSharePassword(
          share.encryptedData,
          share.iv,
          share.authTag,
          share.shareId,
        )
        if (password !== expectedPassword) return { status: 403 as const }
      }

      const [eventRow] = await tx
        .select()
        .from(calendarBackups)
        .where(
          and(
            eq(calendarBackups.userId, share.userId),
            eq(calendarBackups.id, share.eventId),
          ),
        )
      if (!eventRow) return { status: 404 as const }

      const event = decryptServerJson(
        eventRow.encryptedData,
        eventRow.iv,
        eventRow.authTag,
        'calendar-event',
      )
      if (share.isBurn) await tx.delete(shares).where(eq(shares.shareId, id))

      return {
        status: 200 as const,
        data: JSON.stringify(event),
        timestamp: share.timestamp.toISOString(),
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
        reason: 'Share or event not found',
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
  return NextResponse.json({ success: true })
})
