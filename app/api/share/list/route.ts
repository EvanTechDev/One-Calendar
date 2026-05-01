import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const ALGORITHM = 'aes-256-gcm'

function keyV2Unprotected(shareId: string) {
  return crypto.createHash('sha256').update(shareId, 'utf8').digest()
}

function decryptWithKey(encryptedData: string, iv: string, authTag: string, key: Buffer) {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(authTag, 'hex'))
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await prisma.share.findMany({
    where: { userId: user.id },
    orderBy: { timestamp: 'desc' },
    select: { shareId: true, encryptedData: true, iv: true, authTag: true, timestamp: true, isProtected: true },
  })

  const shares = result.map((row) => {
    let eventId = ''
    let eventTitle = ''
    if (!row.isProtected) {
      try {
        const decrypted = decryptWithKey(row.encryptedData, row.iv, row.authTag, keyV2Unprotected(row.shareId))
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

  return NextResponse.json({ shares })
}
