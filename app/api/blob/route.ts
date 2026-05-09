import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth-server'
import { db } from '@/lib/drizzle/client'
import { calendarBackups } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'

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

    await db.insert(calendarBackups)
      .values({
        userId,
        encryptedData: encrypted_data,
        iv,
        timestamp: new Date(),
      })
      .onConflictDoUpdate({
        target: calendarBackups.userId,
        set: { encryptedData: encrypted_data, iv, timestamp: new Date() },
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

    const [result] = await db.select({
      encryptedData: calendarBackups.encryptedData,
      iv: calendarBackups.iv,
      timestamp: calendarBackups.timestamp,
    })
      .from(calendarBackups)
      .where(eq(calendarBackups.userId, userId))

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

    await db.delete(calendarBackups).where(eq(calendarBackups.userId, userId))

    return NextResponse.json({ success: true, backend: 'postgres' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
