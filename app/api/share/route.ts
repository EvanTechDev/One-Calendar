import { type NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth/session'

const ALGORITHM = 'aes-256-gcm'
const keyV2Unprotected = (shareId: string) => crypto.createHash('sha256').update(shareId, 'utf8').digest()
const keyV3Password = (password: string, shareId: string) => crypto.scryptSync(password, shareId, 32)

function encryptWithKey(data: string, key: Buffer) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return { encryptedData: encrypted, iv: iv.toString('hex'), authTag: cipher.getAuthTag().toString('hex') }
}

function decryptWithKey(encryptedData: string, iv: string, authTag: string, key: Buffer): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(authTag, 'hex'))
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, data, password, burnAfterRead } = await request.json()
  if (!id || data == null) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  const hasPassword = typeof password === 'string' && password.length > 0
  const payload = typeof data === 'string' ? data : JSON.stringify(data)
  const { encryptedData, iv, authTag } = encryptWithKey(payload, hasPassword ? keyV3Password(password, id) : keyV2Unprotected(id))
  await prisma.share.upsert({
    where: { shareId: id },
    update: { userId: session.userId, encryptedData, iv, authTag, timestamp: new Date(), isProtected: hasPassword, isBurn: !!burnAfterRead, encVersion: hasPassword ? 3 : 2 },
    create: { userId: session.userId, shareId: id, encryptedData, iv, authTag, timestamp: new Date(), isProtected: hasPassword, isBurn: !!burnAfterRead, encVersion: hasPassword ? 3 : 2 },
  })
  return NextResponse.json({ success: true, id, protected: hasPassword, burnAfterRead: !!burnAfterRead, shareLink: `/share/${id}` })
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  const password = request.nextUrl.searchParams.get('password') ?? ''
  if (!id) return NextResponse.json({ error: 'Missing share ID' }, { status: 400 })
  const share = await prisma.share.findUnique({ where: { shareId: id } })
  if (!share) return NextResponse.json({ error: 'Share not found' }, { status: 404 })
  if (share.isProtected && !password) return NextResponse.json({ error: 'Password required', requiresPassword: true, burnAfterRead: share.isBurn }, { status: 401 })
  try {
    const key = share.isProtected ? keyV3Password(password, id) : keyV2Unprotected(id)
    const data = decryptWithKey(share.encryptedData, share.iv, share.authTag, key)
    if (share.isBurn) await prisma.share.delete({ where: { shareId: id } })
    return NextResponse.json({ success: true, data, timestamp: share.timestamp, protected: share.isProtected, burnAfterRead: share.isBurn })
  } catch {
    return NextResponse.json({ error: 'Invalid password' }, { status: 403 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await request.json()
  await prisma.share.deleteMany({ where: { shareId: id, userId: session.userId } })
  return NextResponse.json({ success: true })
}
