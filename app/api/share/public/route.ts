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

async function wasPublicBurnConsumed(
  ownerDid: string,
  handle: string,
  shareId: string,
) {
  if (!hasPostgres) return false
  const result = await prisma.atprotoShareBurnRead.findFirst({
    where: {
      shareId,
      OR: [{ ownerDid }, { ownerDid: null, handle }],
    },
    select: { shareId: true },
  })
  return !!result
}

async function markPublicBurnConsumed(
  ownerDid: string,
  handle: string,
  shareId: string,
) {
  if (!hasPostgres) return
  await prisma.atprotoShareBurnRead.upsert({
    where: {
      shareId_handle: {
        shareId,
        handle,
      },
    },
    update: {
      ownerDid,
      pdsDeleteSynced: false,
      burnedAt: new Date(),
    },
    create: {
      handle,
      ownerDid,
      shareId,
      pdsDeleteSynced: false,
    },
  })
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
