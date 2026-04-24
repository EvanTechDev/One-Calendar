import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import crypto from 'crypto'
import { getAtprotoSession } from '@/lib/atproto-auth'
import { deleteRecord, listRecords } from '@/lib/atproto'
import type { DpopPublicJwk } from '@/lib/dpop'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const ALGORITHM = 'aes-256-gcm'
const ATPROTO_SHARE_COLLECTION = 'app.onecalendar.share'

let burnTableReady = false

async function ensureBurnTable() {
  if (burnTableReady) return
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

async function syncBurnedAtprotoShares(
  ownerDid: string,
  handle: string,
  pds: string,
  accessToken: string,
  dpopPrivateKeyPem?: string,
  dpopPublicJwk?: DpopPublicJwk,
) {
  await ensureBurnTable()

  const pending = await prisma.$queryRaw<Array<{ share_id: string }>`
    SELECT share_id FROM atproto_share_burn_reads
    WHERE (owner_did = ${ownerDid} OR (owner_did IS NULL AND handle = ${handle}))
    AND pds_delete_synced = FALSE
  `

  if (!pending.length) return

  const syncedIds: string[] = []
  for (const row of pending) {
    const shareId = String(row.share_id)
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
    } catch {
    }
  }

  if (syncedIds.length > 0) {
    await prisma.$executeRaw`
      DELETE FROM atproto_share_burn_reads
      WHERE (owner_did = ${ownerDid} OR (owner_did IS NULL AND handle = ${handle}))
      AND share_id = ANY(${syncedIds}::text[])
    `
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

  const result = await prisma.$queryRaw<
    Array<{
      share_id: string
      encrypted_data: string
      iv: string
      auth_tag: string
      timestamp: Date
      is_protected: boolean
    }>
  >`SELECT share_id, encrypted_data, iv, auth_tag, timestamp, is_protected FROM shares WHERE user_id = ${user.id} ORDER BY timestamp DESC`

  const shares = result.map((row) => {
    let eventId = ''
    let eventTitle = ''
    if (!row.is_protected) {
      try {
        const decrypted = decryptWithKey(
          row.encrypted_data,
          row.iv,
          row.auth_tag,
          keyV2Unprotected(row.share_id),
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
      id: row.share_id,
      eventId,
      eventTitle,
      sharedBy: user.id,
      shareDate: row.timestamp.toISOString(),
      shareLink: `/share/${row.share_id}`,
      isProtected: row.is_protected,
    }
  })

  return NextResponse.json({ shares })
}
