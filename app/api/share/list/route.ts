import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth/session'

const ALGORITHM = 'aes-256-gcm'
const keyV2Unprotected = (shareId: string) => crypto.createHash('sha256').update(shareId, 'utf8').digest()
function decryptWithKey(encryptedData: string, iv: string, authTag: string, key: Buffer) {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(authTag, 'hex'))
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const result = await prisma.share.findMany({ where: { userId: session.userId }, orderBy: { timestamp: 'desc' } })
  const shares = result.map((row) => {
    let eventId = '', eventTitle = ''
    if (!row.isProtected) {
      try {
        const dataObj = JSON.parse(decryptWithKey(row.encryptedData, row.iv, row.authTag, keyV2Unprotected(row.shareId)))
        eventId = dataObj.id ?? ''
        eventTitle = dataObj.title ?? ''
      } catch {}
    }
    return { id: row.shareId, eventId, eventTitle: row.isProtected ? '受保护' : eventTitle, sharedBy: session.user.email, shareDate: row.timestamp.toISOString(), shareLink: `/share/${row.shareId}`, isProtected: row.isProtected }
  })
  return NextResponse.json({ shares })
}
