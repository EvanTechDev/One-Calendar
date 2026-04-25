import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { currentUser } from '@clerk/nextjs/server'
import { getAtprotoSession } from '@/lib/atproto-auth'
import { deleteRecord, getRecord, putRecord } from '@/lib/atproto'
import { db, schema } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ATPROTO_BACKUP_COLLECTION = 'app.onecalendar.backup'
const ATPROTO_BACKUP_RKEY = 'latest'

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')
  return response
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const encrypted_data = body?.ciphertext
    const iv = body?.iv

    if (typeof encrypted_data !== 'string' || typeof iv !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const atproto = await getAtprotoSession()
    if (atproto) {
      await putRecord({
        pds: atproto.pds,
        repo: atproto.did,
        collection: ATPROTO_BACKUP_COLLECTION,
        rkey: ATPROTO_BACKUP_RKEY,
        accessToken: atproto.accessToken,
        dpopPrivateKeyPem: atproto.dpopPrivateKeyPem,
        dpopPublicJwk: atproto.dpopPublicJwk,
        record: {
          $type: ATPROTO_BACKUP_COLLECTION,
          ciphertext: encrypted_data,
          iv,
          updatedAt: new Date().toISOString(),
        },
      })
      return NextResponse.json({ success: true, backend: 'atproto' })
    }

    const user = await currentUser()
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const now = new Date()

    await db
      .insert(schema.calendarBackups)
      .values({
        userId: user.id,
        encryptedData: encrypted_data,
        iv,
        timestamp: now,
      })
      .onConflictDoUpdate({
        target: schema.calendarBackups.userId,
        set: {
          encryptedData: encrypted_data,
          iv,
          timestamp: now,
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
    const atproto = await getAtprotoSession()
    if (atproto) {
      try {
        const record = await getRecord({
          pds: atproto.pds,
          repo: atproto.did,
          collection: ATPROTO_BACKUP_COLLECTION,
          rkey: ATPROTO_BACKUP_RKEY,
          accessToken: atproto.accessToken,
          dpopPrivateKeyPem: atproto.dpopPrivateKeyPem,
          dpopPublicJwk: atproto.dpopPublicJwk,
        })
        const value = record.value ?? {}
        return jsonNoStore({
          ciphertext: value.ciphertext,
          iv: value.iv,
          timestamp: value.updatedAt,
          backend: 'atproto',
        })
      } catch {
        return jsonNoStore({ error: 'Not found' }, { status: 404 })
      }
    }

    const user = await currentUser()
    if (!user) return jsonNoStore({ error: 'Unauthorized' }, { status: 401 })

    const result = await db
      .select({
        encryptedData: schema.calendarBackups.encryptedData,
        iv: schema.calendarBackups.iv,
        timestamp: schema.calendarBackups.timestamp,
      })
      .from(schema.calendarBackups)
      .where(eq(schema.calendarBackups.userId, user.id))
      .limit(1)

    const backup = result[0]
    if (!backup) return jsonNoStore({ error: 'Not found' }, { status: 404 })

    return jsonNoStore({
      ciphertext: backup.encryptedData,
      iv: backup.iv,
      timestamp: backup.timestamp,
      backend: 'postgres',
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error'
    return jsonNoStore({ error: message }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const atproto = await getAtprotoSession()
    if (atproto) {
      await deleteRecord({
        pds: atproto.pds,
        repo: atproto.did,
        collection: ATPROTO_BACKUP_COLLECTION,
        rkey: ATPROTO_BACKUP_RKEY,
        accessToken: atproto.accessToken,
        dpopPrivateKeyPem: atproto.dpopPrivateKeyPem,
        dpopPublicJwk: atproto.dpopPublicJwk,
      })
      return NextResponse.json({ success: true, backend: 'atproto' })
    }

    const user = await currentUser()
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await db
      .delete(schema.calendarBackups)
      .where(eq(schema.calendarBackups.userId, user.id))

    return NextResponse.json({ success: true, backend: 'postgres' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
