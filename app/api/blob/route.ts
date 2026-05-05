import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'

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

export async function POST(req: NextRequest) {
  try {
    const [session, body] = await Promise.all([getServerSession(), req.json()])
    const userId = session?.user?.id

    if (!userId)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const encrypted_data = body?.ciphertext
    const iv = body?.iv

    if (typeof encrypted_data !== 'string' || typeof iv !== 'string')
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

    await prisma.calendarBackup.upsert({
      where: { userId },
      update: { encryptedData: encrypted_data, iv, timestamp: new Date() },
      create: {
        userId,
        encryptedData: encrypted_data,
        iv,
        timestamp: new Date(),
      },
    })

    return NextResponse.json({ success: true, backend: 'postgres' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await getServerSession()
    const userId = session?.user?.id

    if (!userId) return jsonNoStore({ error: 'Unauthorized' }, { status: 401 })

    const result = await prisma.calendarBackup.findUnique({
      where: { userId },
      select: { encryptedData: true, iv: true, timestamp: true },
    })
    if (!result) return jsonNoStore({ error: 'Not found' }, { status: 404 })

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
}

export async function DELETE() {
  try {
    const session = await getServerSession()
    const userId = session?.user?.id

    if (!userId)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await prisma.calendarBackup.deleteMany({ where: { userId } })

    return NextResponse.json({ success: true, backend: 'postgres' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
