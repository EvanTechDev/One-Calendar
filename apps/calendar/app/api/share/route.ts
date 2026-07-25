import { type NextRequest, NextResponse } from 'next/server'
import { withEvlog, useLogger, getAuditActor } from '@/lib/evlog'
import { getServerSession } from '@/lib/auth/server'
import crypto from 'crypto'
import { db } from '@/lib/drizzle/client'
import { shares, calendarEvents } from '@/lib/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { decryptField } from '@/lib/field-crypto'

export const runtime = 'nodejs'

const ALGORITHM = 'aes-256-gcm'

function deriveKey(salt: string, shareId: string): Buffer {
  return crypto.hkdfSync(
    'sha256',
    Buffer.from(salt, 'utf8'),
    Buffer.from(shareId, 'utf8'),
    'share-key',
    32,
  )
}

function deriveKeyWithPassword(password: string, shareId: string): Buffer {
  return crypto.scryptSync(password, shareId, 32)
}

function encryptWithKey(
  data: string,
  key: Buffer,
): { encryptedPayload: string } {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return {
    encryptedPayload: JSON.stringify({
      ct: encrypted,
      iv: iv.toString('hex'),
      tag: authTag.toString('hex'),
    }),
  }
}

function decryptWithKey(encryptedPayload: string, key: Buffer): string {
  const parsed = JSON.parse(encryptedPayload)
  const ivBuffer = Buffer.from(parsed.iv, 'hex')
  const authTagBuffer = Buffer.from(parsed.tag, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer)
  decipher.setAuthTag(authTagBuffer)
  let decrypted = decipher.update(parsed.ct, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export const POST = withEvlog(async function POST(request: NextRequest) {
  try {
    const log = useLogger()
    const body = await request.json()
    const { eventId, password, burnAfterRead } = body as {
      eventId?: string
      password?: string
      burnAfterRead?: boolean
    }
    if (!eventId)
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })

    const session = await getServerSession()
    const user = session?.user
    if (!user) {
      log.audit?.({
        action: 'share.create',
        actor: getAuditActor(log),
        target: { type: 'share', id: eventId },
        outcome: 'denied',
        reason: 'Authentication required',
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [event] = await db
      .select()
      .from(calendarEvents)
      .where(
        and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, user.id)),
      )

    if (!event)
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    const shareId = crypto.randomUUID()
    const hasPassword = typeof password === 'string' && password.length > 0
    const burn = !!burnAfterRead
    const shareSalt = process.env.SALT

    if (!shareSalt) {
      return NextResponse.json(
        { error: 'Server misconfigured: missing SALT' },
        { status: 500 },
      )
    }

    const eventData = JSON.stringify({
      id: event.id,
      title: decryptField(event.id, event.title),
      description: decryptField(event.id, event.description),
      location: decryptField(event.id, event.location),
      startDate: event.startDate,
      endDate: event.endDate,
      isAllDay: event.isAllDay,
      color: event.color,
    })

    const key = hasPassword
      ? deriveKeyWithPassword(password as string, shareId)
      : deriveKey(shareSalt, shareId)

    const { encryptedPayload } = encryptWithKey(eventData, key)

    await db.insert(shares).values({
      id: shareId,
      userId: user.id,
      eventId: event.id,
      encryptedPayload,
      hasPassword,
      burnAfterRead: burn,
      createdAt: new Date(),
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
      reason: burn
        ? 'User created burn-after-read share'
        : 'User created share',
    })

    return NextResponse.json({
      success: true,
      id: shareId,
      protected: hasPassword,
      burnAfterRead: burn,
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
      const [share] = await tx.select().from(shares).where(eq(shares.id, id))

      if (!share) return { status: 404 as const }
      if (share.hasPassword && !password)
        return { status: 401 as const, burnAfterRead: share.burnAfterRead }

      const shareSalt = process.env.SALT
      if (!shareSalt) return { status: 500 as const }

      const key = share.hasPassword
        ? deriveKeyWithPassword(password, id)
        : deriveKey(shareSalt, id)

      let decryptedData: string
      try {
        decryptedData = decryptWithKey(share.encryptedPayload, key)
      } catch {
        return { status: 403 as const, protected: share.hasPassword }
      }

      if (share.burnAfterRead) await tx.delete(shares).where(eq(shares.id, id))

      return {
        status: 200 as const,
        data: decryptedData,
        createdAt: share.createdAt.toISOString(),
        protected: share.hasPassword,
        burnAfterRead: share.burnAfterRead,
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
      log.audit?.({
        action: 'share.export',
        actor: getAuditActor(log),
        target: { type: 'share', id },
        outcome: 'denied',
        reason: 'Password required',
      })
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
      log.audit?.({
        action: 'share.export',
        actor: getAuditActor(log),
        target: { type: 'share', id },
        outcome: 'denied',
        reason: result.protected
          ? 'Invalid password'
          : 'Failed to decrypt share data',
      })
      return NextResponse.json(
        {
          error: result.protected
            ? 'Invalid password'
            : 'Failed to decrypt share data.',
        },
        { status: 403 },
      )
    }
    if (result.status === 500) {
      return NextResponse.json(
        { error: 'Server misconfigured: missing SALT' },
        { status: 500 },
      )
    }

    log.audit?.({
      action: result.burnAfterRead ? 'share.burn_after_read' : 'share.export',
      actor: getAuditActor(log),
      target: { type: 'share', id },
      outcome: 'success',
      reason: result.burnAfterRead
        ? 'Burn-after-read share exported and deleted'
        : 'Share exported',
    })

    return NextResponse.json({
      success: true,
      data: result.data,
      createdAt: result.createdAt,
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
    .where(and(eq(shares.id, id), eq(shares.userId, user.id)))

  log.audit?.({
    action: 'share.delete',
    actor: getAuditActor(log, {
      type: 'user',
      id: user.id,
      email: user.email,
    }),
    target: { type: 'share', id },
    outcome: 'success',
    reason: 'User deleted share',
  })

  return NextResponse.json({ success: true })
})
