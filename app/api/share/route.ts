import { type NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import crypto from 'crypto'
import { and, eq, sql } from 'drizzle-orm'
import { deleteRecord, getRecord, putRecord } from '@/lib/atproto'
import { getAtprotoSession } from '@/lib/atproto-auth'
import { db, schema } from '@/lib/db'

export const runtime = 'nodejs'

const ALGORITHM = 'aes-256-gcm'
const ATPROTO_SHARE_COLLECTION = 'app.onecalendar.share'

function keyV2Unprotected(shareId: string) {
  return crypto.createHash('sha256').update(shareId, 'utf8').digest()
}

function keyV3Password(password: string, shareId: string) {
  return crypto.scryptSync(password, shareId, 32)
}

function encryptWithKey(
  data: string,
  key: Buffer,
): { encryptedData: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return {
    encryptedData: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  }
}

function decryptWithKey(
  encryptedData: string,
  iv: string,
  authTag: string,
  key: Buffer,
): string {
  const ivBuffer = Buffer.from(iv, 'hex')
  const authTagBuffer = Buffer.from(authTag, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer)
  decipher.setAuthTag(authTagBuffer)
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

function formatTimestamp(value: Date | string) {
  return (value instanceof Date ? value : new Date(value)).toISOString()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, data, password, burnAfterRead } = body as {
      id?: string
      data?: unknown
      password?: string
      burnAfterRead?: boolean
    }

    if (!id || data === undefined || data === null) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      )
    }

    const hasPassword = typeof password === 'string' && password.length > 0
    const burn = !!burnAfterRead
    const dataString = typeof data === 'string' ? data : JSON.stringify(data)
    const key = hasPassword
      ? keyV3Password(password as string, id)
      : keyV2Unprotected(id)
    const { encryptedData, iv, authTag } = encryptWithKey(dataString, key)

    const atproto = await getAtprotoSession()
    if (atproto) {
      await putRecord({
        pds: atproto.pds,
        repo: atproto.did,
        collection: ATPROTO_SHARE_COLLECTION,
        rkey: id,
        accessToken: atproto.accessToken,
        dpopPrivateKeyPem: atproto.dpopPrivateKeyPem,
        dpopPublicJwk: atproto.dpopPublicJwk,
        record: {
          $type: ATPROTO_SHARE_COLLECTION,
          encryptedData,
          iv,
          authTag,
          isProtected: hasPassword,
          isBurn: burn,
          timestamp: new Date().toISOString(),
        },
      })

      return NextResponse.json({
        success: true,
        id,
        protected: hasPassword,
        burnAfterRead: burn,
        shareLink: `/${atproto.handle}/${id}`,
      })
    }

    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const now = new Date()

    await db
      .insert(schema.shares)
      .values({
        userId: user.id,
        shareId: id,
        encryptedData,
        iv,
        authTag,
        timestamp: now,
        isProtected: hasPassword,
        isBurn: burn,
        encVersion: hasPassword ? 3 : 2,
      })
      .onConflictDoUpdate({
        target: schema.shares.shareId,
        set: {
          userId: user.id,
          encryptedData,
          iv,
          authTag,
          timestamp: now,
          isProtected: hasPassword,
          isBurn: burn,
          encVersion: hasPassword ? 3 : 2,
        },
      })

    return NextResponse.json({
      success: true,
      id,
      protected: hasPassword,
      burnAfterRead: burn,
      shareLink: `/share/${id}`,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 },
    )
  }
}

async function getAtprotoShare(
  id: string,
  password: string,
  handleParam?: string,
) {
  const atproto = await getAtprotoSession()
  if (atproto) {
    const record = await getRecord({
      pds: atproto.pds,
      repo: atproto.did,
      collection: ATPROTO_SHARE_COLLECTION,
      rkey: id,
      accessToken: atproto.accessToken,
      dpopPrivateKeyPem: atproto.dpopPrivateKeyPem,
      dpopPublicJwk: atproto.dpopPublicJwk,
    })
    const value = record.value ?? {}
    const isProtected = !!value.isProtected
    if (isProtected && !password) {
      return NextResponse.json(
        {
          error: 'Password required',
          requiresPassword: true,
          burnAfterRead: value.isBurn,
        },
        { status: 401 },
      )
    }
    const key = isProtected ? keyV3Password(password, id) : keyV2Unprotected(id)
    const decryptedData = decryptWithKey(
      String(value.encryptedData),
      String(value.iv),
      String(value.authTag),
      key,
    )

    if (value.isBurn) {
      await deleteRecord({
        pds: atproto.pds,
        repo: atproto.did,
        collection: ATPROTO_SHARE_COLLECTION,
        rkey: id,
        accessToken: atproto.accessToken,
        dpopPrivateKeyPem: atproto.dpopPrivateKeyPem,
        dpopPublicJwk: atproto.dpopPublicJwk,
      })
    }

    return NextResponse.json({
      success: true,
      data: decryptedData,
      timestamp: value.timestamp,
      protected: isProtected,
      burnAfterRead: !!value.isBurn,
    })
  }

  if (handleParam) {
    return NextResponse.json(
      {
        error:
          'Public atproto retrieval requires owner session support not configured',
      },
      { status: 400 },
    )
  }

  return null
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  const password = request.nextUrl.searchParams.get('password') ?? ''
  const handle = request.nextUrl.searchParams.get('handle') ?? undefined

  if (!id)
    return NextResponse.json({ error: 'Missing share ID' }, { status: 400 })

  try {
    const atprotoResult = await getAtprotoShare(id, password, handle)
    if (atprotoResult) return atprotoResult

    return await db.transaction(async (tx) => {
      const result = await tx.execute(sql<{
        encryptedData: string
        iv: string
        authTag: string
        timestamp: Date | string
        isProtected: boolean
        isBurn: boolean
      }>`select encrypted_data as "encryptedData", iv, auth_tag as "authTag", timestamp, is_protected as "isProtected", is_burn as "isBurn" from shares where share_id = ${id} for update`)
      const share = result.rows[0]

      if (!share) {
        return NextResponse.json({ error: 'Share not found' }, { status: 404 })
      }

      if (share.isProtected && !password) {
        return NextResponse.json(
          {
            error: 'Password required',
            requiresPassword: true,
            burnAfterRead: share.isBurn,
          },
          { status: 401 },
        )
      }

      const key = share.isProtected
        ? keyV3Password(password, id)
        : keyV2Unprotected(id)
      let decryptedData: string
      try {
        decryptedData = decryptWithKey(
          share.encryptedData,
          share.iv,
          share.authTag,
          key,
        )
      } catch {
        return NextResponse.json(
          {
            error: share.isProtected
              ? 'Invalid password'
              : 'Failed to decrypt share data.',
          },
          { status: 403 },
        )
      }

      if (share.isBurn) {
        await tx.delete(schema.shares).where(eq(schema.shares.shareId, id))
      }

      return NextResponse.json({
        success: true,
        data: decryptedData,
        timestamp: formatTimestamp(share.timestamp),
        protected: share.isProtected,
        burnAfterRead: share.isBurn,
      })
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  const body = await request.json()
  const { id } = body as { id?: string }
  if (!id)
    return NextResponse.json({ error: 'Missing share ID' }, { status: 400 })

  const atproto = await getAtprotoSession()
  if (atproto) {
    await deleteRecord({
      pds: atproto.pds,
      repo: atproto.did,
      collection: ATPROTO_SHARE_COLLECTION,
      rkey: id,
      accessToken: atproto.accessToken,
      dpopPrivateKeyPem: atproto.dpopPrivateKeyPem,
      dpopPublicJwk: atproto.dpopPublicJwk,
    })
    return NextResponse.json({ success: true })
  }

  const user = await currentUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await db
    .delete(schema.shares)
    .where(
      and(eq(schema.shares.shareId, id), eq(schema.shares.userId, user.id)),
    )

  return NextResponse.json({ success: true })
}
