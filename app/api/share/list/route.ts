import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import crypto from 'crypto'
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm'
import { getAtprotoSession } from '@/lib/atproto-auth'
import { deleteRecord, listRecords } from '@/lib/atproto'
import type { DpopPublicJwk } from '@/lib/dpop'
import { db, schema } from '@/lib/db'

export const runtime = 'nodejs'

const ALGORITHM = 'aes-256-gcm'
const ATPROTO_SHARE_COLLECTION = 'app.onecalendar.share'

async function syncBurnedAtprotoShares(
  ownerDid: string,
  handle: string,
  pds: string,
  accessToken: string,
  dpopPrivateKeyPem?: string,
  dpopPublicJwk?: DpopPublicJwk,
) {
  const pending = await db
    .select({ shareId: schema.atprotoShareBurnReads.shareId })
    .from(schema.atprotoShareBurnReads)
    .where(
      and(
        eq(schema.atprotoShareBurnReads.pdsDeleteSynced, false),
        or(
          eq(schema.atprotoShareBurnReads.ownerDid, ownerDid),
          and(
            isNull(schema.atprotoShareBurnReads.ownerDid),
            eq(schema.atprotoShareBurnReads.handle, handle),
          ),
        ),
      ),
    )

  if (!pending.length) return

  const syncedIds: string[] = []
  for (const row of pending) {
    const shareId = String(row.shareId)
    try {
      await deleteRecord({
        pds,
        repo: ownerDid,
        collection: ATPROTO_SHARE_COLLECTION,
        rkey: shareId,
        accessToken,
        dpopPrivateKeyPem,
        dpopPublicJwk,
      })
      syncedIds.push(shareId)
    } catch {}
  }

  if (syncedIds.length > 0) {
    await db
      .delete(schema.atprotoShareBurnReads)
      .where(
        and(
          inArray(schema.atprotoShareBurnReads.shareId, syncedIds),
          or(
            eq(schema.atprotoShareBurnReads.ownerDid, ownerDid),
            and(
              isNull(schema.atprotoShareBurnReads.ownerDid),
              eq(schema.atprotoShareBurnReads.handle, handle),
            ),
          ),
        ),
      )
  }
}

function keyV2Unprotected(shareId: string) {
  return crypto.createHash('sha256').update(shareId, 'utf8').digest()
}

function decryptWithKey(
  encryptedData: string,
  iv: string,
  authTag: string,
  key: Buffer,
) {
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

export async function GET() {
  const atproto = await getAtprotoSession()
  if (atproto) {
    await syncBurnedAtprotoShares(
      atproto.did,
      atproto.handle,
      atproto.pds,
      atproto.accessToken,
      atproto.dpopPrivateKeyPem,
      atproto.dpopPublicJwk,
    )

    const data = await listRecords({
      pds: atproto.pds,
      repo: atproto.did,
      collection: ATPROTO_SHARE_COLLECTION,
      accessToken: atproto.accessToken,
      dpopPrivateKeyPem: atproto.dpopPrivateKeyPem,
      dpopPublicJwk: atproto.dpopPublicJwk,
    })
    const shares = (data.records || []).map((record) => {
      const rkey = record.uri.split('/').pop() || ''
      const value = record.value ?? {}
      let eventId = ''
      let eventTitle = ''
      if (!value.isProtected) {
        try {
          const decrypted = decryptWithKey(
            String(value.encryptedData),
            String(value.iv),
            String(value.authTag),
            keyV2Unprotected(rkey),
          )
          const parsed = JSON.parse(decrypted) as {
            id?: string
            title?: string
          }
          eventId = parsed.id || ''
          eventTitle = parsed.title || ''
        } catch {
          eventTitle = ''
        }
      }
      return {
        id: rkey,
        eventId,
        eventTitle: value.isProtected ? 'Protected' : eventTitle,
        sharedBy: atproto.handle,
        shareDate: String(value.timestamp || new Date().toISOString()),
        shareLink: `/${atproto.handle}/${rkey}`,
        isProtected: !!value.isProtected,
      }
    })

    return NextResponse.json({ shares })
  }

  const user = await currentUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await db
    .select({
      shareId: schema.shares.shareId,
      encryptedData: schema.shares.encryptedData,
      iv: schema.shares.iv,
      authTag: schema.shares.authTag,
      timestamp: schema.shares.timestamp,
      isProtected: schema.shares.isProtected,
    })
    .from(schema.shares)
    .where(eq(schema.shares.userId, user.id))
    .orderBy(desc(schema.shares.timestamp))

  const shares = result.map((row) => {
    let eventId = ''
    let eventTitle = ''
    if (!row.isProtected) {
      try {
        const decrypted = decryptWithKey(
          row.encryptedData,
          row.iv,
          row.authTag,
          keyV2Unprotected(row.shareId),
        )
        const dataObj = JSON.parse(decrypted)
        eventId = dataObj.id ?? ''
        eventTitle = dataObj.title ?? ''
      } catch {}
    } else {
      eventId = '受保护'
      eventTitle = '受保护'
    }
    return {
      id: row.shareId,
      eventId,
      eventTitle,
      sharedBy: user.id,
      shareDate: row.timestamp.toISOString(),
      shareLink: `/share/${row.shareId}`,
      isProtected: row.isProtected,
    }
  })

  return NextResponse.json({ shares })
}
