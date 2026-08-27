import crypto from 'crypto'
import { eq, and, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/drizzle/client'
import { eventInvites, eventInviteOccurrences } from '@/lib/drizzle/schema'
import { shiftExdates } from '@/lib/recurrence/engine'
import {
  decryptInviteToken,
  protectInviteToken,
} from '@/lib/invites/invite-token'

/**
 * Either the singleton connection or a transaction executor. The split runs
 * inside a caller-supplied transaction in both implementations, so this must
 * never open one of its own.
 */
type Dbx =
  | ReturnType<typeof getDb>
  | Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0]

export interface CarryInvitesParams {
  oldMasterId: string
  newMasterId: string
  /** The stamp the old series is truncated at — the tail begins here. */
  boundaryStamp: string
  /**
   * The new series' anchor, whose time-of-day the carried stamps adopt.
   * Deliberately a clock source and NOT a millisecond delta: measuring a delta
   * from the old anchor to the boundary day shifted every carried grant by the
   * distance between them, so a same-time `following` edit silently moved a
   * participant's grant by weeks — losing the start of the tail they were
   * granted, extending a bounded grant past what was granted, and stranding
   * carried exceptions on stamps the new series never generates.
   */
  clockSource: Date
  timeZone?: string
}

/**
 * Moves participant grants that reach past a split boundary onto the new
 * master, keeping each invite token so no participant is re-invited.
 *
 * Grants living entirely before the boundary stay on the old master and are
 * deliberately not copied — which is why this is per-stamp rather than a
 * wholesale copy. See
 * ADR-0009 (invites and their visibility survive a series split).
 *
 * Shared by the REST route's `applySplitPlan` and the MCP one so the ADR-0009
 * invariant exists in exactly one place. Must be called INSIDE the split's
 * transaction and BEFORE any delete of an emptied old master, or the grants are
 * destroyed with nothing having been preserved.
 */
export async function carryInvitesAcrossSplit(
  tx: Dbx,
  params: CarryInvitesParams,
): Promise<void> {
  const { oldMasterId, newMasterId, boundaryStamp, clockSource, timeZone } =
    params

  const invites = await tx
    .select()
    .from(eventInvites)
    .where(eq(eventInvites.eventId, oldMasterId))
  if (invites.length === 0) return

  // The same clock remap the override path applies to override stamps: the
  // split series keeps the original rule's day pattern and only adopts a new
  // time-of-day, so a carried stamp must keep its day and take the new clock
  // to keep matching a slot the new series actually generates.
  const shift = (stamp: string) =>
    shiftExdates([stamp], clockSource, timeZone)?.[0] ?? stamp

  for (const invite of invites) {
    const exceptions = await tx
      .select()
      .from(eventInviteOccurrences)
      .where(eq(eventInviteOccurrences.inviteId, invite.id))

    const tailExceptions = exceptions.filter(
      (e) => e.recurrenceId >= boundaryStamp,
    )
    const baselineReachesTail =
      invite.baselineKind === 'all' &&
      (invite.untilStamp === null || invite.untilStamp > boundaryStamp)

    if (!baselineReachesTail && tailExceptions.length === 0) continue

    const carriedId = crypto.randomUUID()
    const rawToken = decryptInviteToken(invite)
    const [carried] = await tx
      .insert(eventInvites)
      .values({
        id: carriedId,
        eventId: newMasterId,
        email: invite.email,
        status: invite.status,
        // Same raw token, re-encrypted for the destination row id.
        ...protectInviteToken(carriedId, rawToken),
        emailSent: invite.emailSent,
        addedToCalendar: invite.addedToCalendar,
        categoryId: invite.categoryId,
        baselineKind: baselineReachesTail ? 'all' : 'none',
        fromStamp: baselineReachesTail
          ? shift(
              invite.fromStamp && invite.fromStamp > boundaryStamp
                ? invite.fromStamp
                : boundaryStamp,
            )
          : null,
        untilStamp:
          baselineReachesTail && invite.untilStamp
            ? shift(invite.untilStamp)
            : null,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
        updatedAt: new Date(),
      })
      .onConflictDoNothing({
        target: [eventInvites.eventId, eventInvites.email],
      })
      .returning()

    if (!carried) continue

    if (tailExceptions.length > 0) {
      await tx.insert(eventInviteOccurrences).values(
        tailExceptions.map((e) => ({
          id: crypto.randomUUID(),
          inviteId: carried.id,
          // Re-stamped when the split moved the occurrence times, mirroring
          // what the override path does for override rows.
          recurrenceId: shift(e.recurrenceId),
          visible: e.visible,
          status: e.status,
          createdAt: e.createdAt,
          updatedAt: new Date(),
        })),
      )
    }

    // The old master keeps only what precedes the boundary.
    if (tailExceptions.length > 0) {
      await tx.delete(eventInviteOccurrences).where(
        and(
          eq(eventInviteOccurrences.inviteId, invite.id),
          inArray(
            eventInviteOccurrences.recurrenceId,
            tailExceptions.map((e) => e.recurrenceId),
          ),
        ),
      )
    }
    if (baselineReachesTail) {
      await tx
        .update(eventInvites)
        .set({ untilStamp: boundaryStamp, updatedAt: new Date() })
        .where(eq(eventInvites.id, invite.id))
    }
  }
}
