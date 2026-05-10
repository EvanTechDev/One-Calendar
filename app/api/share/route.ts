import { type NextRequest, NextResponse } from 'next/server'
import { withEvlog, useLogger, getAuditActor } from '@/lib/evlog'
import { getServerSession } from '@/lib/auth-server'
import crypto from 'crypto'
import { db } from '@/lib/drizzle/client'
import { shares } from '@/lib/drizzle/schema'
import { eq, and } from 'drizzle-orm'

export const runtime = 'nodejs'

const ALGORITHM = 'aes-256-gcm'

function keyV2Unprotected(shareId: string) {
  return crypto.createHash('sha256').update(shareId, 'utf8').digest()
}

function keyV3Password(password: string, shareId: string) {
  return crypto.scryptSync(password, shareId, 32)
}

function encryptWithKey(
  data: string,
  key: Buffer,
): { encryptedData: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return {
    encryptedData: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  }
}

function decryptWithKey(
  encryptedData: string,
  iv: string,
  authTag: string,
  key: Buffer,
): string {
  const ivBuffer = Buffer.from(iv, 'hex')
  const authTagBuffer = Buffer.from(authTag, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer)
  decipher.setAuthTag(authTagBuffer)
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export const POST = withEvlog(async function POST(request: NextRequest) {
  try {
    const log = useLogger()
    const body = await request.json()
    const { id, data, password, burnAfterRead } = body as {
      id?: string
      data?: unknown
      password?: string
      burnAfterRead?: boolean
    }
    if (!id || data === undefined || data === null)
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      )

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
    const burn = !!burnAfterRead
    const dataString = typeof data === 'string' ? data : JSON.stringify(data)
    const key = hasPassword
      ? keyV3Password(password as string, id)
      : keyV2Unprotected(id)
    const { encryptedData, iv, authTag } = encryptWithKey(dataString, key)
    const now = new Date()

    await db
      .insert(shares)
      .values({
        userId: user.id,
        shareId: id,
        encryptedData,
        iv,
        authTag,
        timestamp: now,
        isProtected: hasPassword,
        isBurn: burn,
        encVersion: hasPassword ? 3 : 2,
      })
      .onConflictDoUpdate({
        target: shares.shareId,
        set: {
          userId: user.id,
          encryptedData,
          iv,
          authTag,
          timestamp: now,
          isProtected: hasPassword,
          isBurn: burn,
          encVersion: hasPassword ? 3 : 2,
        },
      })

    log.audit?.({
      action: 'share.create',
      actor: getAuditActor(log, {
        type: 'user',
        id: user.id,
        email: user.email,
      }),
      target: { type: 'share', id },
      outcome: 'success',
      reason: burn
        ? 'User created burn-after-read share'
        : 'User created share',
    })

    return NextResponse.json({
      success: true,
      id,
      protected: hasPassword,
      burnAfterRead: burn,
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
      if (share.isProtected && !password)
        return { status: 401 as const, burnAfterRead: share.isBurn }

      const key = share.isProtected
        ? keyV3Password(password, id)
        : keyV2Unprotected(id)
      let decryptedData: string
      try {
        decryptedData = decryptWithKey(
          share.encryptedData,
          share.iv,
          share.authTag,
          key,
        )
      } catch {
        return { status: 403 as const, protected: share.isProtected }
      }
      if (share.isBurn) await tx.delete(shares).where(eq(shares.shareId, id))

      return {
        status: 200 as const,
        data: decryptedData,
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
