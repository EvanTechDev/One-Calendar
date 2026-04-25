import { type NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import crypto from 'crypto'
import { deleteRecord, getRecord, putRecord } from '@/lib/atproto'
import { getAtprotoSession } from '@/lib/atproto-auth'
import { prisma } from '@/lib/prisma'

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
  
    await prisma.share.upsert({
      where: { shareId: id },
      update: {
        userId: user.id,
        encryptedData,
        iv,
        authTag,
        timestamp: new Date(),
        isProtected: hasPassword,
        isBurn: burn,
        encVersion: hasPassword ? 3 : 2,
      },
      create: {
        userId: user.id,
        shareId: id,
        encryptedData,
        iv,
        authTag,
        timestamp: new Date(),
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

    const result = await prisma.$transaction(async (tx) => {
      const share = await tx.share.findUnique({
        where: { shareId: id },
        select: {
          encryptedData: true,
          iv: true,
          authTag: true,
          timestamp: true,
          isProtected: true,
          isBurn: true,
        },
      })

      if (!share) {
        return { status: 404 as const }
      }

      if (share.isProtected && !password) {
        return { status: 401 as const, burnAfterRead: share.isBurn }
      }

      const key = share.isProtected ? keyV3Password(password, id) : keyV2Unprotected(id)
      let decryptedData: string
      try {
        decryptedData = decryptWithKey(
          share.encryptedData,
          share.iv,
          share.authTag,
          key,
        )
      } catch {
        return { status: 403 as const, protected: share.isProtected }
      }

      if (share.isBurn) {
        await tx.share.delete({ where: { shareId: id } })
      }

      return {
        status: 200 as const,
        data: decryptedData,
        timestamp: share.timestamp.toISOString(),
        protected: share.isProtected,
        burnAfterRead: share.isBurn,
      }
    })

    if (result.status === 404) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 })
    }

    if (result.status === 401) {
      return NextResponse.json(
        {
          error: 'Password required',
          requiresPassword: true,
          burnAfterRead: result.burnAfterRead,
        },
        { status: 401 },
      )
    }

    if (result.status === 403) {
      return NextResponse.json(
        {
          error: result.protected
            ? 'Invalid password'
            : 'Failed to decrypt share data.',
        },
        { status: 403 },
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      timestamp: result.timestamp,
      protected: result.protected,
      burnAfterRead: result.burnAfterRead,
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

  await prisma.share.deleteMany({ where: { shareId: id, userId: user.id } })

  return NextResponse.json({ success: true })
}
