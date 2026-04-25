import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { currentUser } from '@clerk/nextjs/server'
import { getAtprotoSession } from '@/lib/atproto-auth'
import { deleteRecord, getRecord, putRecord } from '@/lib/atproto'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const postgresUrl = process.env.POSTGRES_URL
let inited = false

type BackupColumns = {
  userId: 'user_id' | '"userId"'
  encryptedData: 'encrypted_data' | '"encryptedData"'
  timestamp: 'timestamp' | '"updatedAt"'
}

async function initDB() {
  if (!postgresUrl) {
    throw new Error('POSTGRES_URL is not configured')
  }
  if (inited) return
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS calendar_backups (
      user_id TEXT PRIMARY KEY,
      encrypted_data TEXT NOT NULL,
      iv TEXT NOT NULL,
      timestamp TIMESTAMP NOT NULL
    )
  `)
  inited = true
}

async function getBackupColumns(): Promise<BackupColumns> {
  await initDB()

  const result = await db.execute(sql<{
    column_name: string
  }>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'calendar_backups'
  `)

  const columns = new Set(result.rows.map((row) => row.column_name))

  const userId = columns.has('user_id') ? 'user_id' : '"userId"'
  const encryptedData = columns.has('encrypted_data')
    ? 'encrypted_data'
    : '"encryptedData"'
  const timestamp = columns.has('timestamp') ? 'timestamp' : '"updatedAt"'

  return { userId, encryptedData, timestamp }
}

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

    const columns = await getBackupColumns()
    const now = new Date()

    await db.execute(sql`
      INSERT INTO calendar_backups (
        ${sql.raw(columns.userId)},
        ${sql.raw(columns.encryptedData)},
        iv,
        ${sql.raw(columns.timestamp)}
      )
      VALUES (${user.id}, ${encrypted_data}, ${iv}, ${now})
      ON CONFLICT (${sql.raw(columns.userId)})
      DO UPDATE SET
        ${sql.raw(columns.encryptedData)} = ${encrypted_data},
        iv = ${iv},
        ${sql.raw(columns.timestamp)} = ${now}
    `)

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

    const columns = await getBackupColumns()

    const result = await db.execute(sql<{
      encrypted_data: string
      iv: string
      timestamp: Date
    }>`
      SELECT
        ${sql.raw(columns.encryptedData)} AS encrypted_data,
        iv,
        ${sql.raw(columns.timestamp)} AS timestamp
      FROM calendar_backups
      WHERE ${sql.raw(columns.userId)} = ${user.id}
      LIMIT 1
    `)

    if (result.rows.length === 0)
      return jsonNoStore({ error: 'Not found' }, { status: 404 })

    return jsonNoStore({
      ciphertext: result.rows[0].encrypted_data,
      iv: result.rows[0].iv,
      timestamp: result.rows[0].timestamp,
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

    const columns = await getBackupColumns()

    await db.execute(sql`
      DELETE FROM calendar_backups
      WHERE ${sql.raw(columns.userId)} = ${user.id}
    `)

    return NextResponse.json({ success: true, backend: 'postgres' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
