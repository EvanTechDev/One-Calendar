import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (typeof body?.ciphertext !== 'string' || typeof body?.iv !== 'string') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  await prisma.calendarBackup.upsert({
    where: { userId: session.userId },
    update: { encryptedData: body.ciphertext, iv: body.iv, timestamp: new Date() },
    create: { userId: session.userId, encryptedData: body.ciphertext, iv: body.iv, timestamp: new Date() },
  })

  return NextResponse.json({ success: true })
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const backup = await prisma.calendarBackup.findUnique({ where: { userId: session.userId } })
  if (!backup) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ciphertext: backup.encryptedData, iv: backup.iv, timestamp: backup.timestamp })
}

export async function DELETE() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await prisma.calendarBackup.deleteMany({ where: { userId: session.userId } })
  return NextResponse.json({ success: true })
}
