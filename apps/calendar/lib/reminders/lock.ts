import crypto from 'node:crypto'
import { and, eq, gt, lt } from 'drizzle-orm'
import { setTimeout as delay } from 'node:timers/promises'
import { getDb } from '@/lib/drizzle/client'
import { reminderLocks } from '@/lib/drizzle/schema'

const LEASE_MS = 120_000
export type RenewLease = () => Promise<void>

/** A database lease works across Fluid instances; a module-local mutex does not.
 * All writes are autocommitted, including the send receipt BEFORE network I/O.
 * Provider requests time out in 15s, well inside the renewable 120s lease.
 */
export async function withReminderLock<T>(
  userId: string,
  run: (renew: RenewLease) => Promise<T>,
): Promise<T> {
  const db = getDb()
  const token = crypto.randomUUID()
  const deadline = Date.now() + 20_000
  for (;;) {
    const now = new Date()
    const [claim] = await db
      .insert(reminderLocks)
      .values({ userId, token, expiresAt: new Date(+now + LEASE_MS) })
      .onConflictDoUpdate({
        target: reminderLocks.userId,
        set: { token, expiresAt: new Date(+now + LEASE_MS) },
        setWhere: lt(reminderLocks.expiresAt, now),
      })
      .returning({ token: reminderLocks.token })
    if (claim) break
    if (Date.now() >= deadline)
      throw new Error('Reminder reconciliation busy; retry')
    await delay(100)
  }
  const renew = async () => {
    const now = new Date()
    const rows = await db
      .update(reminderLocks)
      .set({ expiresAt: new Date(+now + LEASE_MS) })
      .where(
        and(
          eq(reminderLocks.userId, userId),
          eq(reminderLocks.token, token),
          gt(reminderLocks.expiresAt, now),
        ),
      )
      .returning({ token: reminderLocks.token })
    if (!rows.length) throw new Error('Reminder lease expired; retry')
  }
  try {
    return await run(renew)
  } finally {
    await db
      .delete(reminderLocks)
      .where(
        and(eq(reminderLocks.userId, userId), eq(reminderLocks.token, token)),
      )
  }
}
