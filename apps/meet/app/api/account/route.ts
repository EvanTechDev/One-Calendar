import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import {
  user as userTable,
  session as sessionTable,
  account as accountTable,
  twoFactor as twoFactorTable,
} from '@zntr/auth/schema'
import { deleteMeetingsForOrganiser } from '@zntr/meetings'
import { getDb } from '@/lib/drizzle'
import { getServerSession } from '@/lib/auth/server'

export const runtime = 'nodejs'

/**
 * Deletes the signed-in account.
 *
 * Meet can offer this now that the shared account panel is mounted here
 * (ADR 0022). It deletes the same account the calendar's endpoint would, and the
 * result is the same, but the mechanism differs and the difference matters:
 *
 * **This app cannot see the calendar's tables.** Its drizzle client is built from
 * `authSchema` and `meetingsSchema` only, deliberately — the meetings package must
 * not import the calendar's schema (ADR 0017). So there is no `delete from
 * calendar_events` here.
 *
 * It is still complete, because every calendar table references `user.id` with
 * `ON DELETE CASCADE`. Removing the user row removes its events, settings,
 * categories, countdowns and bookmarks as a database operation rather than an
 * application one.
 *
 * Meetings are the exception and are deleted explicitly: `meeting.organiser_id`
 * has no FK to the user (ADR 0017), so without this a deleted account leaves
 * never-expiring, still-joinable rooms that nobody can ever end — `isOrganiser`
 * needs either that user's session, now gone, or a Creator Token, which is null
 * for a signed-in organiser. The child rows (sessions, attendance, chat) do have
 * real cascades within the package.
 */
export async function DELETE() {
  try {
    const session = await getServerSession()
    const user = session?.user
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getDb()
    await db.transaction(async (tx) => {
      // Inside the transaction so a failed account delete cannot destroy the
      // meetings on its own.
      await deleteMeetingsForOrganiser(tx, user.id)
      await tx.delete(sessionTable).where(eq(sessionTable.userId, user.id))
      await tx.delete(accountTable).where(eq(accountTable.userId, user.id))
      await tx.delete(twoFactorTable).where(eq(twoFactorTable.userId, user.id))
      // Last: the cascades hanging off this row do the rest, including the
      // calendar's tables this app cannot name.
      await tx.delete(userTable).where(eq(userTable.id, user.id))
    })

    console.warn('[account] deleted', { userId: user.id })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[account] delete failed', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
