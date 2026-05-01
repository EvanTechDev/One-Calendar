import { type NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const ALGORITHM = 'aes-256-gcm'

function keyV2Unprotected(shareId: string) {
  return crypto.createHash('sha256').update(shareId, 'utf8').digest()
}

function keyV3Password(password: string, shareId: string) {
  return crypto.scryptSync(password, shareId, 32)
}

function encryptWithKey(data: string, key: Buffer) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return { encryptedData: encrypted, iv: iv.toString('hex'), authTag: authTag.toString('hex') }
}

function decryptWithKey(encryptedData: string, iv: string, authTag: string, key: Buffer): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(authTag, 'hex'))
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export async function POST(request: NextRequest) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, data, password, burnAfterRead } = await request.json()
  if (!id || data == null) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  const hasPassword = typeof password === 'string' && password.length > 0
  const key = hasPassword ? keyV3Password(password, id) : keyV2Unprotected(id)
  const dataString = typeof data === 'string' ? data : JSON.stringify(data)
  const { encryptedData, iv, authTag } = encryptWithKey(dataString, key)

  const isBurn = Boolean(burnAfterRead)
  const encVersion = hasPassword ? 3 : 2

  await prisma.share.upsert({
    where: { shareId: id },
    update: { encryptedData, iv, authTag, isProtected: hasPassword, isBurn, encVersion, timestamp: new Date(), userId: user.id },
    create: { shareId: id, encryptedData, iv, authTag, isProtected: hasPassword, isBurn, encVersion, timestamp: new Date(), userId: user.id },
  })

  return NextResponse.json({ success: true, shareLink: `/share/${id}` })
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  const password = request.nextUrl.searchParams.get('password') ?? ''
  if (!id) return NextResponse.json({ error: 'Missing share id' }, { status: 400 })

  const row = await prisma.share.findUnique({ where: { shareId: id } })
  if (!row) return NextResponse.json({ error: 'Share not found' }, { status: 404 })
  if (row.isProtected && !password) {
    return NextResponse.json({ error: 'Password required', requiresPassword: true }, { status: 401 })
  }

  const key = row.isProtected ? keyV3Password(password, id) : keyV2Unprotected(id)
  try {
    const decryptedData = decryptWithKey(row.encryptedData, row.iv, row.authTag, key)
    if (row.isBurn) {
      await prisma.share.delete({ where: { shareId: id } })
    }
    return NextResponse.json({ success: true, data: decryptedData, protected: row.isProtected, burnAfterRead: row.isBurn, encVersion: row.encVersion, timestamp: row.timestamp })
  } catch {
    return NextResponse.json({ error: row.isProtected ? 'Invalid password' : 'Failed to decrypt' }, { status: 403 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing share id' }, { status: 400 })
  await prisma.share.deleteMany({ where: { shareId: id, userId: user.id } })
  return NextResponse.json({ success: true })
}
