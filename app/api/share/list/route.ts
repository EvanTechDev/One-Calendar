import { type NextRequest, NextResponse } from 'next/server'
import { withEvlog, useLogger, getAuditActor } from '@/lib/evlog'
import { getServerSession } from '@/lib/auth/server'
import crypto from 'crypto'
import { db } from '@/lib/drizzle/client'
import { shares } from '@/lib/drizzle/schema'
import { eq, desc } from 'drizzle-orm'

export const runtime = 'nodejs'

const ALGORITHM = 'aes-256-gcm'

function keyV2Unprotected(shareId: string) {
  return crypto.createHash('sha256').update(shareId, 'utf8').digest()
}

function decryptWithKey(
  encryptedData: string,
  iv: string,
  authTag: string,
  key: Buffer,
) {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'hex'),
  )
  decipher.setAuthTag(Buffer.from(authTag, 'hex'))
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
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
    .select()
    .from(shares)
    .where(eq(shares.userId, user.id))
    .orderBy(desc(shares.timestamp))

  const shareList = result.map((row) => {
    let eventId = ''
    let eventTitle = ''
    if (!row.isProtected) {
      try {
        const decrypted = decryptWithKey(
          row.encryptedData,
          row.iv,
          row.authTag,
          keyV2Unprotected(row.shareId),
        )
        const dataObj = JSON.parse(decrypted)
        eventId = dataObj.id ?? ''
        eventTitle = dataObj.title ?? ''
      } catch {}
    } else {
      eventId = '受保护'
      eventTitle = '受保护'
    }
    return {
      id: row.shareId,
      eventId,
      eventTitle,
      sharedBy: user.id,
      shareDate: row.timestamp.toISOString(),
      shareLink: `/share/${row.shareId}`,
      isProtected: row.isProtected,
    }
  })

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
