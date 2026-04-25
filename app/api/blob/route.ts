import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let initDBPromise: Promise<void> | null = null

function initDB(): Promise<void> {
  if (!initDBPromise) {
    initDBPromise = prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS calendar_backups (
        user_id TEXT PRIMARY KEY,
        encrypted_data TEXT NOT NULL,
        iv TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL
      )
    `.then(() => undefined).catch((e) => {
      initDBPromise = null
      throw e
    })
  }
  return initDBPromise
}

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...NO_STORE_HEADERS, ...(init?.headers ?? {}) },
  })
}

export async function POST(req: NextRequest) {
  try {
    const [{ userId }, body] = await Promise.all([auth(), req.json()])

    if (!userId)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const encrypted_data = body?.ciphertext
    const iv = body?.iv

    if (typeof encrypted_data !== 'string' || typeof iv !== 'string')
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

    await Promise.all([
      initDB(),
    ])

    await prisma.$executeRaw`
      INSERT INTO calendar_backups (user_id, encrypted_data, iv, timestamp)
      VALUES (${userId}, ${encrypted_data}, ${iv}, ${new Date().toISOString()})
      ON CONFLICT (user_id)
      DO UPDATE SET
        encrypted_data = EXCLUDED.encrypted_data,
        iv = EXCLUDED.iv,
        timestamp = EXCLUDED.timestamp
    `

    return NextResponse.json({ success: true, backend: 'postgres' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const [{ userId }] = await Promise.all([auth(), initDB()])

    if (!userId)
      return jsonNoStore({ error: 'Unauthorized' }, { status: 401 })

    const result = await prisma.$queryRaw`SELECT encrypted_data, iv, timestamp FROM calendar_backups WHERE user_id = ${userId}` as Array<{ encrypted_data: string; iv: string; timestamp: Date }>

    if (result.length === 0)
      return jsonNoStore({ error: 'Not found' }, { status: 404 })

    return jsonNoStore({
      ciphertext: result[0].encrypted_data,
      iv: result[0].iv,
      timestamp: result[0].timestamp,
      backend: 'postgres',
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error'
    return jsonNoStore({ error: message }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const [{ userId }] = await Promise.all([auth(), initDB()])

    if (!userId)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await prisma.$executeRaw`DELETE FROM calendar_backups WHERE user_id = ${userId}`

    return NextResponse.json({ success: true, backend: 'postgres' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
