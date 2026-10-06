import crypto from 'node:crypto'
import { and, eq, inArray, isNotNull, isNull, lte } from 'drizzle-orm'
import { getDb } from '@/lib/drizzle/client'
import {
  calendarEvents,
  scheduledReminders,
  settings,
  user,
} from '@/lib/drizzle/schema'
import { decryptEvent } from '@/lib/event-crypto'
import { APP_CONFIG } from '@/lib/config'
import { decryptFieldStrict, encryptField } from '@/lib/field-crypto'
import {
  cancelEmail,
  rescheduleEmail,
  scheduleEmail,
  scheduledEmailStatus,
  MAX_SCHEDULE_AHEAD_MS,
} from '@/lib/email/send-scheduled-email'
import { buildReminderEmail } from '@/lib/email/reminder-template'
import {
  expandSeriesView,
  MAX_EXPANSION,
  type SeriesViewInput,
} from '@zntr/ui/calendar/lib/recurrence/engine'
import {
  applyQuota,
  candidatesFor,
  dueDateIn,
  scheduleKey,
  SendQuotaExceeded,
  type ReminderCandidate,
} from './email-schedule'
import { withReminderLock, type RenewLease } from './lock'

export { SendQuotaExceeded }
type Receipt = typeof scheduledReminders.$inferSelect
type Event = ReturnType<typeof decryptEvent>
type Payload = {
  from: string
  to: string
  subject: string
  html: string
  scheduledAt: string
}
type Wanted = {
  candidate: ReminderCandidate
  event: Event
  contentHash: string
  timeRange: string
}

function timeRangeFor(event: Event, timeZone: string): string {
  const start = new Date(event.startDate)
  const end = new Date(event.endDate)
  if (event.isAllDay) {
    const first = dueDateIn(start, timeZone)
    const last = dueDateIn(new Date(Math.max(+start, +end - 1)), timeZone)
    return `${first === last ? first : `${first} – ${last}`} (All day)`
  }
  const options: Intl.DateTimeFormatOptions = {
    timeZone,
    timeZoneName: 'short',
  }
  return `${start.toLocaleString('en-US', options)} – ${end.toLocaleString('en-US', options)}`
}

/** Only expand the provider horizon, including each override's own lead time.
 * The engine remains the sole owner of EXDATE, moved overrides and DST rules.
 */
async function desired(
  event: Event,
  rows: Event[],
  to: string,
  timeZone: string,
  now: Date,
): Promise<Map<string, Wanted>> {
  const lead =
    Math.max(
      0,
      ...[event, ...rows].map((e) =>
        Number.isFinite(e.notificationMinutes) &&
        (e.notificationMinutes ?? -1) >= 0
          ? e.notificationMinutes!
          : 0,
      ),
    ) * 60_000
  const instances = event.rrule
    ? (expandSeriesView(
        [event as unknown as SeriesViewInput],
        rows as unknown as SeriesViewInput[],
        now,
        new Date(+now + MAX_SCHEDULE_AHEAD_MS + lead),
        MAX_EXPANSION,
        timeZone,
      ) as unknown as Event[])
    : [event]
  const wanted = new Map<string, Wanted>()
  for (const instance of instances) {
    const [candidate] = candidatesFor({
      occurrences: [
        {
          eventId: event.id,
          recurrenceId: event.rrule ? instance.recurrenceId : null,
          startDate: new Date(instance.startDate),
        },
      ],
      notificationMinutes: instance.notificationMinutes,
      emailReminder: instance.emailReminder,
      now,
      timeZone,
      alreadyScheduled: new Set(),
    })
    if (!candidate) continue
    const timeRange = timeRangeFor(instance, timeZone)
    const contentHash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify([
          'reminder-v2',
          to,
          instance.title,
          instance.description ?? '',
          instance.location ?? '',
          timeRange,
          process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
        ]),
      )
      .digest('hex')
      .slice(0, 32)
    wanted.set(scheduleKey(candidate), {
      candidate,
      event: instance,
      contentHash,
      timeRange,
    })
  }
  return wanted
}

/** Recover the SAME immutable request after an ambiguous network/DB failure.
 * Resend keys expire in 24h. Never replay an uncertain send after that window:
 * retain the encrypted receipt for investigation instead of risking duplicates.
 */
async function deliver(
  receipt: Receipt,
  renew: RenewLease,
): Promise<string | null> {
  if (receipt.providerId) return receipt.providerId
  if (!receipt.payload) return null
  if (Date.now() - +new Date(receipt.createdAt) >= 23 * 60 * 60_000)
    throw new Error(
      `Unresolved reminder receipt ${receipt.id}; provider idempotency window expired`,
    )
  const payload = JSON.parse(
    decryptFieldStrict(receipt.id, receipt.payload)!,
  ) as Payload
  await renew()
  const providerId = await scheduleEmail({
    ...payload,
    scheduledAt: new Date(payload.scheduledAt),
    idempotencyKey: `reminder/${receipt.id}`,
  })
  await renew()
  await getDb()
    .update(scheduledReminders)
    .set({ providerId, updatedAt: new Date() })
    .where(eq(scheduledReminders.id, receipt.id))
  receipt.providerId = providerId
  return providerId
}

/** Unknown cancellation keeps its receipt and blocks a replacement. */
async function cancelOne(
  receipt: Receipt,
  renew: RenewLease,
): Promise<boolean> {
  if (receipt.sentAt) return false
  await renew()
  await getDb()
    .update(scheduledReminders)
    .set({ cancelPending: true })
    .where(eq(scheduledReminders.id, receipt.id))
  const id = await deliver(receipt, renew)
  if (!id) return false
  await renew()
  // Most past receipts are already delivered. A status read avoids a doomed
  // cancellation request on every ordinary top-up run.
  let status: Awaited<ReturnType<typeof scheduledEmailStatus>> =
    +new Date(receipt.dueAt) <= Date.now()
      ? await scheduledEmailStatus(id)
      : 'pending'
  if (status === 'pending') {
    await renew()
    const canceled = await cancelEmail(id)
    status = canceled ? 'canceled' : await scheduledEmailStatus(id)
  }
  await renew()
  if (status === 'canceled') {
    await getDb()
      .delete(scheduledReminders)
      .where(eq(scheduledReminders.id, receipt.id))
    return true
  }
  if (status === 'sent') {
    receipt.sentAt = new Date()
    await getDb()
      .update(scheduledReminders)
      .set({ sentAt: receipt.sentAt, updatedAt: new Date() })
      .where(eq(scheduledReminders.id, receipt.id))
  }
  return false
}

async function synchronize(
  userId: string,
  eventId: string,
  strictQuota: boolean,
  renew: RenewLease,
): Promise<{ scheduled: number; cancelled: number }> {
  const db = getDb()
  let [row] = await db
    .select()
    .from(calendarEvents)
    .where(
      and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)),
    )
  // Old releases could queue an override as a standalone event. Cancel that
  // duplicate receipt, then reconcile its parent, never schedule both.
  if (row?.seriesId) {
    const legacy = await db
      .select()
      .from(scheduledReminders)
      .where(
        and(
          eq(scheduledReminders.eventId, row.id),
          eq(scheduledReminders.userId, userId),
        ),
      )
    for (const receipt of legacy)
      if (!(await cancelOne(receipt, renew)) && !receipt.sentAt)
        return { scheduled: 0, cancelled: 0 }
    eventId = row.seriesId
    ;[row] = await db
      .select()
      .from(calendarEvents)
      .where(
        and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)),
      )
  }
  // Independent reads start together; provider operations stay ordered because
  // cancellation must be confirmed before replacement and quota is per user.
  const [existing, preferences, addresses, overrideRows] = await Promise.all([
    db
      .select()
      .from(scheduledReminders)
      .where(
        and(
          eq(scheduledReminders.eventId, eventId),
          eq(scheduledReminders.userId, userId),
        ),
      ),
    db
      .select({ data: settings.data })
      .from(settings)
      .where(eq(settings.userId, userId)),
    db.select({ email: user.email }).from(user).where(eq(user.id, userId)),
    row?.rrule
      ? db
          .select()
          .from(calendarEvents)
          .where(
            and(
              eq(calendarEvents.seriesId, eventId),
              eq(calendarEvents.userId, userId),
            ),
          )
      : Promise.resolve([]),
  ])
  let scheduled = 0
  let cancelled = 0
  const overrides = overrideRows.map(decryptEvent)
  const legacyStamps = new Map(
    overrides.map((override) => [override.id, override.recurrenceId]),
  )
  // Cron may visit the master before legacy standalone override receipts.
  // Resolve those sends first rather than relying on arbitrary row order.
  if (overrides.length) {
    const legacy = await db
      .select()
      .from(scheduledReminders)
      .where(
        and(
          eq(scheduledReminders.userId, userId),
          inArray(
            scheduledReminders.eventId,
            overrides.map((override) => override.id),
          ),
          isNull(scheduledReminders.sentAt),
        ),
      )
    for (const receipt of legacy) {
      if (await cancelOne(receipt, renew)) cancelled++
      else if (!receipt.sentAt) return { scheduled, cancelled }
    }
  }
  let timeZone =
    (preferences[0]?.data as { timezone?: string } | null)?.timezone ?? 'UTC'
  try {
    new Intl.DateTimeFormat('en', { timeZone })
  } catch {
    timeZone = 'UTC'
  }
  const to = addresses[0]?.email
  const now = new Date()
  const wanted =
    row && to
      ? await desired(decryptEvent(row), overrides, to, timeZone, now)
      : new Map<string, Wanted>()
  const seen = new Set<string>()
  for (const receipt of existing) {
    if (receipt.sentAt) continue
    const key = scheduleKey(receipt)
    const target = wanted.get(key)
    const duplicate = seen.has(key)
    seen.add(key)
    // Persist the cancellation intent BEFORE recovering an ambiguous send.
    // Otherwise a recovery timeout on the old split could admit a new tail.
    if (
      receipt.cancelPending ||
      !target ||
      duplicate ||
      receipt.contentHash !== target.contentHash
    ) {
      if (await cancelOne(receipt, renew)) cancelled++
      continue
    }
    // A past send may already be delivered. Do not replace it on a later edit.
    const providerId = await deliver(receipt, renew)
    if (providerId && +new Date(receipt.dueAt) <= +now) {
      await renew()
      const status = await scheduledEmailStatus(providerId)
      if (status === 'sent') {
        await db
          .update(scheduledReminders)
          .set({ sentAt: now, updatedAt: now })
          .where(eq(scheduledReminders.id, receipt.id))
        continue
      }
      if (status === 'unknown') continue
    }
    if (+new Date(receipt.dueAt) === +target.candidate.dueAt) continue
    if (receipt.dueDate !== target.candidate.dueDate) {
      // A cross-day PATCH with a lost response makes the quota's day uncertain.
      // Confirm cancellation, then reserve the new day before a fresh send.
      if (await cancelOne(receipt, renew)) cancelled++
      continue
    }
    await renew()
    if (
      providerId &&
      (await rescheduleEmail(providerId, target.candidate.dueAt))
    ) {
      await renew()
      await db
        .update(scheduledReminders)
        .set({
          dueAt: target.candidate.dueAt,
          dueDate: target.candidate.dueDate,
          updatedAt: new Date(),
        })
        .where(eq(scheduledReminders.id, receipt.id))
      scheduled++
    }
    // A failed PATCH is ambiguous. Keep its receipt and retry, never re-send.
  }
  const allReceipts = await db
    .select({
      eventId: scheduledReminders.eventId,
      recurrenceId: scheduledReminders.recurrenceId,
      dueDate: scheduledReminders.dueDate,
      cancelPending: scheduledReminders.cancelPending,
      sentAt: scheduledReminders.sentAt,
    })
    .from(scheduledReminders)
    .where(eq(scheduledReminders.userId, userId))
  // In a split, the old root is reconciled before the new root. If its cancel
  // failed, do not create a duplicate under the new occurrence identity.
  if (allReceipts.some((r) => r.cancelPending && !r.sentAt))
    return { scheduled, cancelled }
  const used = new Map<string, number>()
  const booked = new Set<string>()
  for (const receipt of allReceipts) {
    used.set(receipt.dueDate, (used.get(receipt.dueDate) ?? 0) + 1)
    booked.add(scheduleKey(receipt))
    // Already-delivered legacy sends also occupy their canonical occurrence.
    const stamp = legacyStamps.get(receipt.eventId)
    if (stamp) booked.add(scheduleKey({ eventId, recurrenceId: stamp }))
  }
  const missing = [...wanted.values()]
    .filter((w) => !booked.has(scheduleKey(w.candidate)))
    .sort((a, b) => +a.candidate.dueAt - +b.candidate.dueAt)
  const { allowed, refused } = applyQuota({
    candidates: missing.map((w) => w.candidate),
    usedByDate: used,
  })
  if (strictQuota && refused.length)
    throw new SendQuotaExceeded(refused[0].dueDate)
  for (const candidate of allowed) {
    const target = wanted.get(scheduleKey(candidate))!
    const id = crypto.randomUUID()
    const payload: Payload = {
      from: APP_CONFIG.auth.resend.sender,
      to: to!,
      subject: `Reminder: ${target.event.title}`,
      html: await buildReminderEmail({
        title: target.event.title,
        timeRange: target.timeRange,
        description: target.event.description ?? undefined,
        location: target.event.location ?? undefined,
        appUrl: `${process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'}/app`,
      }),
      scheduledAt: candidate.dueAt.toISOString(),
    }
    await renew()
    const receipt: Receipt = {
      id,
      userId,
      eventId,
      recurrenceId: candidate.recurrenceId,
      dueAt: candidate.dueAt,
      dueDate: candidate.dueDate,
      providerId: null,
      contentHash: target.contentHash,
      payload: encryptField(id, JSON.stringify(payload)),
      cancelPending: false,
      sentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await db.insert(scheduledReminders).values(receipt)
    // No transaction wraps this external side effect: the encrypted receipt
    // survives a timeout or process crash and gives every retry the same key.
    await deliver(receipt, renew)
    scheduled++
  }
  return { scheduled, cancelled }
}

export async function reconcileEventReminders(params: {
  userId: string
  eventId: string
  strictQuota?: boolean
}): Promise<{ scheduled: number; cancelled: number }> {
  return withReminderLock(params.userId, async (renewLease) => {
    const deadline = Date.now() + 45_000
    const renew = async () => {
      if (Date.now() >= deadline)
        throw new Error('Reminder reconciliation budget exhausted; retry')
      await renewLease()
    }
    return synchronize(
      params.userId,
      params.eventId,
      params.strictQuota ?? false,
      renew,
    )
  })
}

export async function cancelRemindersForEvents(
  eventIds: string[],
): Promise<void> {
  if (!eventIds.length) return
  const rows = await getDb()
    .select()
    .from(scheduledReminders)
    .where(inArray(scheduledReminders.eventId, eventIds))
  for (const userId of new Set(rows.map((r) => r.userId))) {
    await withReminderLock(userId, async (renew) => {
      const current = await getDb()
        .select()
        .from(scheduledReminders)
        .where(
          and(
            eq(scheduledReminders.userId, userId),
            inArray(scheduledReminders.eventId, eventIds),
          ),
        )
      for (const row of current) await cancelOne(row, renew)
    })
  }
}

/** Kept for callers of the old split helper; new mutations reconcile BOTH roots. */
export async function clearRemindersPastSplit({
  oldMasterId,
  boundaryStamp,
}: {
  oldMasterId: string
  boundaryStamp: string
}): Promise<void> {
  const rows = await getDb()
    .select()
    .from(scheduledReminders)
    .where(eq(scheduledReminders.eventId, oldMasterId))
  for (const userId of new Set(rows.map((r) => r.userId)))
    await withReminderLock(userId, async (renew) => {
      const current = await getDb()
        .select()
        .from(scheduledReminders)
        .where(
          and(
            eq(scheduledReminders.userId, userId),
            eq(scheduledReminders.eventId, oldMasterId),
          ),
        )
      for (const row of current)
        if (row.recurrenceId && row.recurrenceId >= boundaryStamp)
          await cancelOne(row, renew)
    })
}

/** Unresolved provider receipts are never pruned just because their date passed. */
export async function pruneSpentReminders(before: Date): Promise<number> {
  const rows = await getDb()
    .delete(scheduledReminders)
    .where(
      and(
        isNotNull(scheduledReminders.sentAt),
        lte(scheduledReminders.dueAt, before),
      ),
    )
    .returning({ id: scheduledReminders.id })
  return rows.length
}

/** Includes disabled/deleted events whose cancellations failed, not just opt-ins. */
export async function pendingReminderEvents(): Promise<
  Array<{ id: string; userId: string }>
> {
  const rows = await getDb()
    .select({
      id: scheduledReminders.eventId,
      userId: scheduledReminders.userId,
    })
    .from(scheduledReminders)
    .where(isNull(scheduledReminders.sentAt))
  return [...new Map(rows.map((r) => [`${r.userId}|${r.id}`, r])).values()]
}
