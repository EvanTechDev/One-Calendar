import crypto from 'crypto'
import { and, eq, inArray, isNull, lte } from 'drizzle-orm'
import { getDb } from '@/lib/drizzle/client'
import {
  calendarEvents,
  scheduledReminders,
  settings,
  user,
} from '@/lib/drizzle/schema'
import { decryptEvent } from '@/lib/api-helpers'
import {
  cancelEmail,
  rescheduleEmail,
  scheduleEmail,
} from '@/lib/email/send-scheduled-email'
import { buildReminderEmail } from '@/lib/email/reminder-template'
import {
  DEFAULT_EXPANSION_WINDOW_MS,
  MAX_EXPANSION,
  expandSeriesView,
  type SeriesViewInput,
} from '@/lib/recurrence/engine'
import {
  applyQuota,
  candidatesFor,
  dueDateIn,
  scheduleKey,
  SendQuotaExceeded,
  type OccurrenceInput,
  type ReminderCandidate,
} from '@/lib/reminders/email-schedule'

/**
 * Keeps the provider's scheduled sends in step with the events they describe.
 *
 * Because sends are scheduled ahead of time, the provider holds state that goes
 * stale whenever an event moves or disappears — propagating that is the main
 * cost of pre-scheduling. See
 * ADR-0010 (email reminders are opt-in per event and scheduled through Resend).
 */

export { SendQuotaExceeded }

async function timeZoneOf(userId: string): Promise<string | undefined> {
  const [row] = await getDb()
    .select({ data: settings.data })
    .from(settings)
    .where(eq(settings.userId, userId))
  const tz = (row?.data as { timezone?: unknown } | null)?.timezone
  return typeof tz === 'string' && tz ? tz : undefined
}

async function emailOf(userId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
  return row?.email ?? null
}

/** Existing scheduled-send counts per due date, for the quota check. */
async function usedByDate(userId: string): Promise<Map<string, number>> {
  const rows = await getDb()
    .select({ dueDate: scheduledReminders.dueDate })
    .from(scheduledReminders)
    .where(eq(scheduledReminders.userId, userId))
  const counts = new Map<string, number>()
  for (const row of rows) {
    counts.set(row.dueDate, (counts.get(row.dueDate) ?? 0) + 1)
  }
  return counts
}

async function occurrencesOf(
  event: ReturnType<typeof decryptEvent>,
  timeZone?: string,
): Promise<OccurrenceInput[]> {
  const isSeries = !!event.rrule && event.rrule.trim().length > 0
  if (!isSeries) {
    return [
      {
        eventId: event.id,
        recurrenceId: null,
        startDate: new Date(event.startDate),
      },
    ]
  }

  // Overrides must be merged in, or a single-edited occurrence is emailed at its
  // pre-edit time — expandSeries alone returns the pattern's times, not the
  // stored ones.
  const overrides = await getDb()
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.seriesId, event.id))

  return (
    expandSeriesView(
      [event as unknown as SeriesViewInput],
      overrides.map(decryptEvent) as unknown as SeriesViewInput[],
      new Date(Date.now() - DEFAULT_EXPANSION_WINDOW_MS),
      new Date(Date.now() + DEFAULT_EXPANSION_WINDOW_MS),
      MAX_EXPANSION,
      timeZone,
    ) as Array<{ recurrenceId: string | null; startDate: Date }>
  )
    .filter((instance) => instance.recurrenceId !== null)
    .map((instance) => ({
      eventId: event.id,
      recurrenceId: instance.recurrenceId,
      startDate: new Date(instance.startDate),
    }))
}

/**
 * Fingerprint of everything the reminder email renders.
 *
 * Must cover exactly the fields `buildReminderEmail` puts in the subject or
 * body — no more (or unrelated edits needlessly re-create the email) and no
 * less (or an edit silently leaves a stale email queued). The send time is
 * deliberately excluded: that is handled by rescheduling instead.
 */
function reminderContentHash(event: ReturnType<typeof decryptEvent>): string {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify([
        event.title,
        event.description ?? '',
        event.location ?? '',
        event.isAllDay,
      ]),
    )
    .digest('hex')
    .slice(0, 32)
}

async function sendOne(params: {
  candidate: ReminderCandidate
  event: ReturnType<typeof decryptEvent>
  to: string
  timeZone?: string
}): Promise<void> {
  const { candidate, event, to, timeZone } = params
  const occurrenceStart = new Date(
    candidate.dueAt.getTime() + (event.notificationMinutes ?? 0) * 60_000,
  )
  const timeRange = event.isAllDay
    ? `${dueDateIn(occurrenceStart, timeZone)} (All day)`
    : occurrenceStart.toLocaleString('en-US', { timeZone })

  const providerId = await scheduleEmail({
    to,
    subject: `Reminder: ${event.title}`,
    html: await buildReminderEmail({
      title: event.title,
      timeRange,
      appUrl: `${process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'}/app`,
      description: event.description ?? undefined,
      location: event.location ?? undefined,
    }),
    scheduledAt: candidate.dueAt,
  })

  await getDb()
    .insert(scheduledReminders)
    .values({
      id: crypto.randomUUID(),
      userId: event.userId,
      eventId: candidate.eventId,
      recurrenceId: candidate.recurrenceId,
      dueAt: candidate.dueAt,
      dueDate: candidate.dueDate,
      providerId,
      contentHash: reminderContentHash(event),
      sentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [scheduledReminders.eventId, scheduledReminders.recurrenceId],
      set: {
        contentHash: reminderContentHash(event),
        dueAt: candidate.dueAt,
        dueDate: candidate.dueDate,
        providerId,
        updatedAt: new Date(),
      },
    })
}

/**
 * Brings one event's scheduled sends in line with its current state: cancels
 * what no longer applies, moves what shifted, and schedules what is missing.
 *
 * Throws only `SendQuotaExceeded`, which is a deliberate user-visible refusal.
 * Every other failure is swallowed — a provider outage must not fail an event
 * save, and the top-up cron will retry. See ADR-0010.
 */
export async function reconcileEventReminders(params: {
  userId: string
  eventId: string
  /** True to surface a quota refusal; the cron passes false and skips instead. */
  strictQuota?: boolean
}): Promise<{ scheduled: number; cancelled: number }> {
  const { userId, eventId, strictQuota = false } = params

  const [row] = await getDb()
    .select()
    .from(calendarEvents)
    .where(
      and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)),
    )

  const existing = await getDb()
    .select()
    .from(scheduledReminders)
    .where(
      and(
        eq(scheduledReminders.eventId, eventId),
        isNull(scheduledReminders.sentAt),
      ),
    )

  // The event is gone, so nothing about it should still be scheduled.
  if (!row) {
    await cancelAll(existing)
    return { scheduled: 0, cancelled: existing.length }
  }

  const event = decryptEvent(row)
  const timeZone = await timeZoneOf(userId)

  // Reminder switched off, or cleared to "no reminder": cancel everything.
  if (!row.emailReminder || row.notificationMinutes === null) {
    await cancelAll(existing)
    return { scheduled: 0, cancelled: existing.length }
  }

  const occurrences = await occurrencesOf(event, timeZone)
  const wanted = new Map<string, OccurrenceInput>()
  for (const occurrence of occurrences) {
    wanted.set(scheduleKey(occurrence), occurrence)
  }

  // Cancel rows whose occurrence no longer exists (a deleted or moved instance).
  const stale = existing.filter(
    (r) =>
      !wanted.has(
        scheduleKey({ eventId: r.eventId, recurrenceId: r.recurrenceId }),
      ),
  )
  await cancelAll(stale)

  // Bring surviving rows in line with the event as it is now.
  //
  // Two different repairs, because the provider's update endpoint can only move
  // a queued email's SEND TIME — it cannot change its subject or body:
  //   - time moved, content same  -> reschedule in place (cheap, keeps the id)
  //   - content changed           -> cancel and re-create, the only way to
  //                                  refresh what the email actually says
  let rescheduled = 0
  const live = existing.filter((r) => !stale.includes(r))
  const contentHash = reminderContentHash(event)

  for (const r of live) {
    const occurrence = wanted.get(
      scheduleKey({ eventId: r.eventId, recurrenceId: r.recurrenceId }),
    )
    if (!occurrence) continue
    const dueAt = new Date(
      occurrence.startDate.getTime() - row.notificationMinutes * 60_000,
    )
    const timeMoved = dueAt.getTime() !== r.dueAt.getTime()
    // An absent hash is a row written before this column existed. Treat it as
    // unknown rather than stale, so upgrading does not re-create (and re-charge
    // quota for) every already-queued reminder.
    const contentChanged =
      r.contentHash !== null &&
      r.contentHash !== undefined &&
      r.contentHash !== contentHash

    if (!timeMoved && !contentChanged) continue

    if (contentChanged) {
      // Cancelling drops the row; the scheduling pass below re-creates it with
      // the current title, location, and description.
      await cancelAll([r])
      continue
    }

    const moved = r.providerId
      ? await rescheduleEmail(r.providerId, dueAt)
      : false
    if (moved) {
      await getDb()
        .update(scheduledReminders)
        .set({
          dueAt,
          dueDate: dueDateIn(dueAt, timeZone),
          contentHash,
          updatedAt: new Date(),
        })
        .where(eq(scheduledReminders.id, r.id))
      rescheduled++
    } else {
      // The provider would not move it (likely already sent). Drop the row
      // rather than keep a stale provider id; the pass below re-creates it.
      await cancelAll([r])
    }
  }

  const stillScheduled = await getDb()
    .select({
      eventId: scheduledReminders.eventId,
      recurrenceId: scheduledReminders.recurrenceId,
    })
    .from(scheduledReminders)
    .where(eq(scheduledReminders.eventId, eventId))

  const candidates = candidatesFor({
    occurrences,
    notificationMinutes: row.notificationMinutes,
    emailReminder: row.emailReminder,
    now: new Date(),
    timeZone,
    alreadyScheduled: new Set(stillScheduled.map(scheduleKey)),
  })

  if (candidates.length === 0) {
    return { scheduled: rescheduled, cancelled: stale.length }
  }

  const { allowed, refused } = applyQuota({
    candidates,
    usedByDate: await usedByDate(userId),
  })

  if (refused.length > 0 && strictQuota) {
    throw new SendQuotaExceeded(refused[0].dueDate)
  }

  const to = await emailOf(userId)
  if (!to) return { scheduled: rescheduled, cancelled: stale.length }

  let scheduled = 0
  for (const candidate of allowed) {
    try {
      await sendOne({ candidate, event, to, timeZone })
      scheduled++
    } catch {
      // Provider unavailable or misconfigured. The top-up cron retries; an
      // event save must never fail because of a reminder email.
      break
    }
  }

  return { scheduled: scheduled + rescheduled, cancelled: stale.length }
}

async function cancelAll(
  rows: Array<{ id: string; providerId: string | null }>,
): Promise<void> {
  if (rows.length === 0) return
  for (const row of rows) {
    // Cascade deletes the row but does NOT cancel the provider's copy, so an
    // explicit cancel is required or the user is emailed about a deleted event.
    if (row.providerId) await cancelEmail(row.providerId)
  }
  await getDb()
    .delete(scheduledReminders)
    .where(
      inArray(
        scheduledReminders.id,
        rows.map((r) => r.id),
      ),
    )
}

/**
 * Cancels every scheduled send for the given events. Used on the delete paths,
 * where the rows would cascade away but the provider would still send.
 */
export async function cancelRemindersForEvents(
  eventIds: string[],
): Promise<void> {
  if (eventIds.length === 0) return
  const rows = await getDb()
    .select()
    .from(scheduledReminders)
    .where(inArray(scheduledReminders.eventId, eventIds))
  await cancelAll(rows)
}

/**
 * Clears scheduled sends past a split boundary.
 *
 * The tail's occurrence times and stamps may both have moved, so rather than
 * guess at the new values these are cancelled and left for the top-up cron to
 * re-create against the new master. Correct but not instant: a reminder due
 * before the next top-up run is lost, which is the accepted cost of not
 * duplicating the split's stamp arithmetic here.
 */
export async function clearRemindersPastSplit(params: {
  oldMasterId: string
  boundaryStamp: string
}): Promise<void> {
  const { oldMasterId, boundaryStamp } = params
  const rows = await getDb()
    .select()
    .from(scheduledReminders)
    .where(eq(scheduledReminders.eventId, oldMasterId))

  await cancelAll(
    rows.filter(
      (r) => r.recurrenceId !== null && r.recurrenceId >= boundaryStamp,
    ),
  )
}

/** Prunes rows whose send is well past; they are spent. */
export async function pruneSpentReminders(before: Date): Promise<number> {
  const rows = await getDb()
    .select({ id: scheduledReminders.id })
    .from(scheduledReminders)
    .where(lte(scheduledReminders.dueAt, before))
  if (rows.length === 0) return 0
  await getDb()
    .delete(scheduledReminders)
    .where(
      inArray(
        scheduledReminders.id,
        rows.map((r) => r.id),
      ),
    )
  return rows.length
}
