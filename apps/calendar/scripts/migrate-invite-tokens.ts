import { and, gt, isNotNull, isNull, eq } from 'drizzle-orm'
import { getDb } from '@/lib/drizzle/client'
import { eventInvites } from '@/lib/drizzle/schema'
import { looksLikeEnvelope } from '@/lib/field-crypto'
import {
  decryptInviteToken,
  protectInviteToken,
} from '@/lib/invites/invite-token'

const BATCH_SIZE = 100

type InviteTokenRecord = {
  id: string
  inviteToken: string
  inviteTokenHash: string | null
}

export function convertInviteTokenRecord(record: InviteTokenRecord) {
  if (record.inviteTokenHash !== null) {
    if (!looksLikeEnvelope(record.inviteToken)) {
      throw new Error(
        `Protected Invite Token invariant failed for ${record.id}`,
      )
    }
    return null
  }

  const rawToken = decryptInviteToken(record)
  return protectInviteToken(record.id, rawToken)
}

async function assertExistingRowsAreProtected() {
  const db = getDb()
  let afterId: string | undefined
  for (;;) {
    const rows = await db
      .select({
        id: eventInvites.id,
        inviteToken: eventInvites.inviteToken,
        inviteTokenHash: eventInvites.inviteTokenHash,
      })
      .from(eventInvites)
      .where(
        and(
          isNotNull(eventInvites.inviteTokenHash),
          afterId ? gt(eventInvites.id, afterId) : undefined,
        ),
      )
      .orderBy(eventInvites.id)
      .limit(BATCH_SIZE)

    for (const row of rows) convertInviteTokenRecord(row)
    if (rows.length < BATCH_SIZE) return
    afterId = rows.at(-1)!.id
  }
}

export async function migrateInviteTokens(options: { apply: boolean }) {
  await assertExistingRowsAreProtected()
  const db = getDb()
  let afterId: string | undefined
  let scanned = 0
  let updated = 0

  for (;;) {
    const rows = await db
      .select({
        id: eventInvites.id,
        inviteToken: eventInvites.inviteToken,
        inviteTokenHash: eventInvites.inviteTokenHash,
      })
      .from(eventInvites)
      .where(
        and(
          isNull(eventInvites.inviteTokenHash),
          afterId ? gt(eventInvites.id, afterId) : undefined,
        ),
      )
      .orderBy(eventInvites.id)
      .limit(BATCH_SIZE)

    for (const row of rows) {
      scanned++
      const converted = convertInviteTokenRecord(row)
      if (!converted || !options.apply) continue
      const claimed = await db
        .update(eventInvites)
        .set({ ...converted, updatedAt: new Date() })
        .where(
          and(
            eq(eventInvites.id, row.id),
            isNull(eventInvites.inviteTokenHash),
            eq(eventInvites.inviteToken, row.inviteToken),
          ),
        )
        .returning({ id: eventInvites.id })
      if (claimed.length > 0) updated++
    }

    if (rows.length < BATCH_SIZE) break
    afterId = rows.at(-1)!.id
  }

  return { scanned, updated, dryRun: !options.apply }
}

async function main() {
  const result = await migrateInviteTokens({
    apply: process.argv.includes('--apply'),
  })
  console.info('[invite-token-backfill]', result)
}

if (process.argv[1]?.endsWith('migrate-invite-tokens.ts')) {
  void main().then(
    () => process.exit(0),
    (error: unknown) => {
      console.error(
        '[invite-token-backfill] failed',
        error instanceof Error ? error.message : 'Unknown error',
      )
      process.exit(1)
    },
  )
}
