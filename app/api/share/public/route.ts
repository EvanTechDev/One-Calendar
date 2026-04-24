import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getRecord, resolveHandle } from '@/lib/atproto'
import {
  ATPROTO_DISABLED,
  atprotoDisabledResponse,
} from '@/lib/atproto-feature'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const ALGORITHM = 'aes-256-gcm'
const ATPROTO_SHARE_COLLECTION = 'app.onecalendar.share'

const hasPostgres = !!process.env.POSTGRES_URL
let burnTableReady = false

async function ensureBurnTable() {
  if (!hasPostgres || burnTableReady) return
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS atproto_share_burn_reads (
      handle TEXT NOT NULL,
      owner_did TEXT,
      share_id TEXT NOT NULL,
      burned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      pds_delete_synced BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (share_id, handle)
    )
  `
  await prisma.$executeRaw`ALTER TABLE atproto_share_burn_reads ADD COLUMN IF NOT EXISTS owner_did TEXT`
  await prisma.$executeRaw`ALTER TABLE atproto_share_burn_reads ADD COLUMN IF NOT EXISTS pds_delete_synced BOOLEAN NOT NULL DEFAULT FALSE`
  await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS idx_atproto_share_burn_reads_owner_share ON atproto_share_burn_reads(owner_did, share_id) WHERE owner_did IS NOT NULL`
  burnTableReady = true
}

async function wasPublicBurnConsumed(
  ownerDid: string,
  handle: string,
  shareId: string,
) {
  if (!hasPostgres) return false
  await ensureBurnTable()
  const result = await prisma.$queryRaw<Array<{ found: number }>`
    SELECT 1 as found FROM atproto_share_burn_reads
    WHERE (owner_did = ${ownerDid} OR (owner_did IS NULL AND handle = ${handle}))
    AND share_id = ${shareId}
    LIMIT 1
  `
  return result.length > 0
}

async function markPublicBurnConsumed(
  ownerDid: string,
  handle: string,
  shareId: string,
) {
  if (!hasPostgres) return
  await ensureBurnTable()
  await prisma.$executeRaw`
      INSERT INTO atproto_share_burn_reads (handle, owner_did, share_id, pds_delete_synced)
      VALUES (${handle}, ${ownerDid}, ${shareId}, FALSE)
      ON CONFLICT (share_id, handle)
      DO UPDATE SET owner_did = EXCLUDED.owner_did, pds_delete_synced = FALSE, burned_at = NOW()
    `
}

function keyV2Unprotected(shareId: string) {
  return crypto.createHash('sha256').update(shareId, 'utf8').digest()
}

function keyV3Password(password: string, shareId: string) {
  return crypto.scryptSync(password, shareId, 32)
}

function decryptWithKey(
  encryptedData: string,
  iv: string,
  authTag: string,
  key: Buffer,
): string {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'hex'),
  )
  decipher.setAuthTag(Buffer.from(authTag, 'hex'))
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export async function GET(request: NextRequest) {
  if (ATPROTO_DISABLED) return atprotoDisabledResponse()
  const handle = request.nextUrl.searchParams.get('handle')
  const id = request.nextUrl.searchParams.get('id')
  const password = request.nextUrl.searchParams.get('password') ?? ''

  if (!handle || !id)
    return NextResponse.json({ error: 'Missing handle or id' }, { status: 400 })

  const normalizedHandle = handle.replace(/^@/, '').toLowerCase()
  const resolved = await resolveHandle(normalizedHandle)
  const record = await getRecord({
    pds: resolved.pds,
    repo: resolved.did,
    collection: ATPROTO_SHARE_COLLECTION,
    rkey: id,
  })
  const value = record.value ?? {}
  const isProtected = !!value.isProtected
  const isBurn = !!value.isBurn

  if (
    isBurn &&
    (await wasPublicBurnConsumed(resolved.did, normalizedHandle, id))
  ) {
    return NextResponse.json({ error: 'Share not found' }, { status: 404 })
  }

  if (isProtected && !password) {
    return NextResponse.json(
      {
        error: 'Password required',
        requiresPassword: true,
        burnAfterRead: isBurn,
      },
      { status: 401 },
    )
  }

  const key = isProtected ? keyV3Password(password, id) : keyV2Unprotected(id)
  try {
    const decryptedData = decryptWithKey(
      String(value.encryptedData),
      String(value.iv),
      String(value.authTag),
      key,
    )

    if (isBurn) {
      await markPublicBurnConsumed(resolved.did, normalizedHandle, id)
    }

    return NextResponse.json({
      success: true,
      data: decryptedData,
      protected: isProtected,
      burnAfterRead: isBurn,
      timestamp: value.timestamp,
    })
  } catch {
    return NextResponse.json(
      { error: isProtected ? 'Invalid password' : 'Failed to decrypt' },
      { status: 403 },
    )
  }
}
