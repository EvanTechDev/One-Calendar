// @vitest-environment node
/**
 * Lifecycle tests for scheduled reminder emails.
 *
 * The property that matters most: a reminder must never outlive the thing it
 * describes. Because the provider holds the send, a missed cancellation emails
 * the user about a deleted event. See
 * ADR-0010 (email reminders are opt-in per event and scheduled through Resend).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.hoisted(() => {
  process.env.SALT = 'reminder-test-only-encryption-salt'
})
const provider = vi.hoisted(() => ({
  scheduleEmail: vi.fn(
    async (_payload: Record<string, unknown>) => 'provider-1',
  ),
  rescheduleEmail: vi.fn(async () => true),
  cancelEmail: vi.fn(async () => true),
  scheduledEmailStatus: vi.fn(async () => 'unknown'),
}))

const renderReminder = vi.hoisted(() =>
  vi.fn(async (params: unknown) => JSON.stringify(params)),
)

vi.mock('@/lib/email/send-scheduled-email', () => ({
  ...provider,
  MAX_SCHEDULE_AHEAD_MS: 30 * 24 * 60 * 60 * 1000,
  EmailProviderUnavailable: class extends Error {},
}))

vi.mock('@/lib/email/reminder-template', () => ({
  buildReminderEmail: renderReminder,
}))

vi.mock('@/lib/api-helpers', () => ({
  decryptEvent: (e: unknown) => e,
  getAuthedUser: async () => ({ id: 'u1', email: 'u1@example.com' }),
}))
vi.mock('@/lib/event-crypto', () => ({
  decryptEvent: (event: unknown) => event,
}))

const tables: Record<string, Array<Record<string, unknown>>> = {
  calendar_events: [],
  scheduled_reminders: [],
  calendar_settings: [],
  user: [],
  reminder_locks: [],
}

vi.mock('@/lib/drizzle/client', () => ({
  getDb: () => makeDb(),
}))

type Pred = (row: Record<string, unknown>) => boolean

function makeDb() {
  const result = (rows: Array<Record<string, unknown>>) =>
    Object.assign(Promise.resolve(rows), {
      returning: () => Promise.resolve(rows),
    })
  return {
    select: (fields?: Record<string, { name: string }>) => ({
      from: (t: { __name: string }) => ({
        where: (pred: Pred) =>
          Promise.resolve(
            tables[t.__name]
              .filter((r) => pred(r))
              .map((r) =>
                fields
                  ? Object.fromEntries(
                      Object.entries(fields).map(([key, col]) => [
                        key,
                        r[camel(col.name)],
                      ]),
                    )
                  : { ...r },
              ),
          ),
      }),
    }),
    insert: (t: { __name: string }) => ({
      values: (v: Record<string, unknown>) => {
        const apply = (conflict?: {
          target: { name: string }
          set: Record<string, unknown>
          setWhere: Pred
        }) => {
          if (conflict) {
            const field = camel(conflict.target.name)
            const existing = tables[t.__name].find((r) => r[field] === v[field])
            if (existing) {
              if (!conflict.setWhere(existing)) return []
              Object.assign(existing, conflict.set)
              return [{ ...existing }]
            }
          }
          tables[t.__name].push({ ...v })
          return [v]
        }
        return {
          then: (ok: (r: unknown) => unknown) =>
            Promise.resolve(apply()).then(ok),
          onConflictDoUpdate: (conflict: {
            target: { name: string }
            set: Record<string, unknown>
            setWhere: Pred
          }) => ({ returning: () => Promise.resolve(apply(conflict)) }),
        }
      },
    }),
    update: (t: { __name: string }) => ({
      set: (v: Record<string, unknown>) => ({
        where: (pred: Pred) => {
          const rows = tables[t.__name].filter(pred)
          for (const row of rows) Object.assign(row, v)
          return result(rows)
        },
      }),
    }),
    delete: (t: { __name: string }) => ({
      where: (pred: Pred) => {
        const rows = tables[t.__name].filter(pred)
        tables[t.__name] = tables[t.__name].filter((r) => !pred(r))
        return result(rows)
      },
    }),
  }
}

function camel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: (c: { name: string }, v: unknown) => (r: Record<string, unknown>) =>
      r[camel(c.name)] === v,
    and:
      (...ps: Pred[]) =>
      (r: Record<string, unknown>) =>
        ps.every((p) => p(r)),
    isNull: (c: { name: string }) => (r: Record<string, unknown>) =>
      r[camel(c.name)] === null || r[camel(c.name)] === undefined,
    isNotNull: (c: { name: string }) => (r: Record<string, unknown>) =>
      r[camel(c.name)] !== null && r[camel(c.name)] !== undefined,
    inArray:
      (c: { name: string }, vs: unknown[]) => (r: Record<string, unknown>) =>
        vs.includes(r[camel(c.name)]),
    lte: (c: { name: string }, v: Date) => (r: Record<string, unknown>) =>
      (r[camel(c.name)] as Date) <= v,
    lt: (c: { name: string }, v: Date) => (r: Record<string, unknown>) =>
      (r[camel(c.name)] as Date) < v,
    gt: (c: { name: string }, v: Date) => (r: Record<string, unknown>) =>
      (r[camel(c.name)] as Date) > v,
  }
})

vi.mock('@/lib/drizzle/schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/drizzle/schema')>()
  const named = (t: object, name: string) =>
    Object.assign({}, t, { __name: name })
  return {
    ...actual,
    calendarEvents: named(actual.calendarEvents, 'calendar_events'),
    scheduledReminders: named(actual.scheduledReminders, 'scheduled_reminders'),
    settings: named(actual.settings, 'calendar_settings'),
    user: named(actual.user, 'user'),
    reminderLocks: named(actual.reminderLocks, 'reminder_locks'),
  }
})

import {
  cancelRemindersForEvents,
  reconcileEventReminders,
  clearRemindersPastSplit,
  pruneSpentReminders,
  pendingReminderEvents,
} from '@/lib/reminders/reconcile'
import { SendQuotaExceeded } from '@/lib/reminders/email-schedule'

const HOUR = 3_600_000
const DAY = 86_400_000

function seedEvent(overrides: Record<string, unknown> = {}) {
  tables.calendar_events.push({
    id: 'e1',
    userId: 'u1',
    title: 'Standup',
    description: null,
    location: null,
    startDate: new Date(Date.now() + 2 * DAY),
    endDate: new Date(Date.now() + 2 * DAY + HOUR),
    isAllDay: false,
    notificationMinutes: 15,
    emailReminder: true,
    rrule: null,
    exdate: null,
    seriesId: null,
    recurrenceId: null,
    ...overrides,
  })
}

function seedScheduled(overrides: Record<string, unknown> = {}) {
  tables.scheduled_reminders.push({
    id: 'sr1',
    userId: 'u1',
    eventId: 'e1',
    recurrenceId: null,
    dueAt: new Date(Date.now() + 2 * DAY - 15 * 60_000),
    dueDate: '2026-01-01',
    providerId: 'provider-1',
    sentAt: null,
    ...overrides,
  })
}

beforeEach(() => {
  for (const key of Object.keys(tables)) tables[key] = []
  tables.user.push({ id: 'u1', email: 'u1@example.com' })
  provider.scheduleEmail.mockClear()
  provider.rescheduleEmail.mockClear()
  provider.cancelEmail.mockClear()
  provider.scheduleEmail.mockResolvedValue('provider-1')
  provider.rescheduleEmail.mockResolvedValue(true)
  provider.cancelEmail.mockResolvedValue(true)
  provider.scheduledEmailStatus.mockReset().mockResolvedValue('unknown')
  renderReminder.mockClear()
})

describe('reconcileEventReminders', () => {
  it.each(['canceled', 'unknown', 'sent'])(
    'repairs legacy override receipts before the parent queues a replacement (status=%s)',
    async (status) => {
      const canceled = status === 'canceled'
      const start = new Date(Date.now() + 2 * DAY)
      start.setUTCHours(9, 0, 0, 0)
      const stamp = start
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z')
      seedEvent({
        emailReminder: false,
        rrule: 'FREQ=DAILY;COUNT=1',
        startDate: start,
        endDate: new Date(+start + HOUR),
      })
      seedEvent({
        id: 'override',
        seriesId: 'e1',
        recurrenceId: stamp,
        startDate: start,
        endDate: new Date(+start + HOUR),
      })
      seedScheduled({ eventId: 'override', providerId: 'legacy-provider' })
      provider.cancelEmail.mockResolvedValue(canceled)
      provider.scheduledEmailStatus.mockResolvedValue(status)
      await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
      expect(provider.cancelEmail).toHaveBeenCalledWith('legacy-provider')
      expect(provider.scheduleEmail).toHaveBeenCalledTimes(canceled ? 1 : 0)
      expect(tables.scheduled_reminders).toHaveLength(1)
      expect(tables.scheduled_reminders[0].eventId).toBe(
        canceled ? 'e1' : 'override',
      )
      if (canceled)
        expect(provider.cancelEmail.mock.invocationCallOrder[0]).toBeLessThan(
          provider.scheduleEmail.mock.invocationCallOrder[0],
        )
      else expect(tables.scheduled_reminders[0].cancelPending).toBe(true)
      if (status === 'sent')
        expect(tables.scheduled_reminders[0].sentAt).toBeInstanceOf(Date)
    },
  )

  it('recovers the same send after lease loss between provider acceptance and storing its ID', async () => {
    seedEvent()
    provider.scheduleEmail.mockImplementationOnce(async () => {
      tables.reminder_locks = []
      return 'already-accepted'
    })
    await expect(
      reconcileEventReminders({ userId: 'u1', eventId: 'e1' }),
    ).rejects.toThrow('lease expired')
    const originalRequest = provider.scheduleEmail.mock.calls[0][0]
    expect(tables.scheduled_reminders[0].providerId).toBeNull()
    provider.scheduleEmail.mockResolvedValue('already-accepted')
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    expect(provider.scheduleEmail.mock.calls[1][0]).toEqual(originalRequest)
    expect(tables.scheduled_reminders).toHaveLength(1)
    expect(tables.scheduled_reminders[0].providerId).toBe('already-accepted')
  })

  it('recovers and cancels an ambiguous send using its old payload even after the event was deleted', async () => {
    seedEvent()
    provider.scheduleEmail.mockRejectedValueOnce(new Error('response lost'))
    await expect(
      reconcileEventReminders({ userId: 'u1', eventId: 'e1' }),
    ).rejects.toThrow()
    tables.calendar_events = []
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    expect(provider.scheduleEmail.mock.calls[1][0]).toEqual(
      provider.scheduleEmail.mock.calls[0][0],
    )
    expect(provider.cancelEmail).toHaveBeenCalledWith('provider-1')
    expect(tables.scheduled_reminders).toHaveLength(0)
  })

  it('serializes the daily quota across different events for the same user', async () => {
    const start = new Date(Date.now() + 2 * DAY)
    for (let i = 0; i < 6; i++)
      seedEvent({ id: `quota-${i}`, startDate: start })
    await Promise.all(
      tables.calendar_events.map((event) =>
        reconcileEventReminders({ userId: 'u1', eventId: event.id as string }),
      ),
    )
    expect(provider.scheduleEmail).toHaveBeenCalledTimes(5)
    expect(tables.scheduled_reminders).toHaveLength(5)
    expect(tables.reminder_locks).toHaveLength(0)
  })

  it('honors opt-in and opt-out on individual overrides', async () => {
    const start = new Date(Date.now() + 2 * DAY)
    start.setUTCHours(9, 0, 0, 0)
    const stamp = start
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z')
    seedEvent({
      emailReminder: false,
      rrule: 'FREQ=DAILY;COUNT=2',
      startDate: start,
      endDate: new Date(+start + HOUR),
    })
    seedEvent({
      id: 'override',
      seriesId: 'e1',
      recurrenceId: stamp,
      startDate: start,
      endDate: new Date(+start + HOUR),
    })
    await reconcileEventReminders({ userId: 'u1', eventId: 'override' })
    expect(tables.scheduled_reminders).toHaveLength(1)
    expect(tables.scheduled_reminders[0].eventId).toBe('e1')
    tables.calendar_events[1].emailReminder = false
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    expect(tables.scheduled_reminders).toHaveLength(0)
  })

  it('blocks a split replacement until cancellation of the old tail succeeds', async () => {
    seedEvent()
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    tables.calendar_events[0].emailReminder = false
    seedEvent({ id: 'new-tail' })
    provider.cancelEmail.mockResolvedValue(false)
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    await reconcileEventReminders({ userId: 'u1', eventId: 'new-tail' })
    expect(provider.scheduleEmail).toHaveBeenCalledTimes(1)
    provider.cancelEmail.mockResolvedValue(true)
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    await reconcileEventReminders({ userId: 'u1', eventId: 'new-tail' })
    expect(provider.scheduleEmail).toHaveBeenCalledTimes(2)
    expect(tables.scheduled_reminders.map((r) => r.eventId)).toEqual([
      'new-tail',
    ])
  })

  it('persists cancellation intent before recovering an ambiguous old split send', async () => {
    seedEvent()
    provider.scheduleEmail.mockRejectedValueOnce(new Error('response lost'))
    await expect(
      reconcileEventReminders({ userId: 'u1', eventId: 'e1' }),
    ).rejects.toThrow()
    tables.calendar_events[0].emailReminder = false
    seedEvent({ id: 'new-tail' })
    provider.scheduleEmail.mockRejectedValueOnce(new Error('still unavailable'))
    await expect(
      reconcileEventReminders({ userId: 'u1', eventId: 'e1' }),
    ).rejects.toThrow()
    expect(tables.scheduled_reminders[0].cancelPending).toBe(true)
    await reconcileEventReminders({ userId: 'u1', eventId: 'new-tail' })
    expect(provider.scheduleEmail).toHaveBeenCalledTimes(2)
  })

  it('confirms cancellation before moving a reminder into a different quota day', async () => {
    const start = new Date(Date.now() + 3 * DAY)
    start.setUTCHours(9, 0, 0, 0)
    seedEvent({ startDate: start, endDate: new Date(+start + HOUR) })
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    tables.calendar_events[0].notificationMinutes = 24 * 60
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    expect(provider.rescheduleEmail).not.toHaveBeenCalled()
    expect(provider.cancelEmail).toHaveBeenCalledTimes(1)
    expect(provider.scheduleEmail).toHaveBeenCalledTimes(2)
    expect(tables.scheduled_reminders[0].dueAt).toEqual(new Date(+start - DAY))
  })

  it('keeps an unresolved receipt beyond provider idempotency expiry without re-sending', async () => {
    seedEvent()
    provider.scheduleEmail.mockRejectedValueOnce(new Error('response lost'))
    await expect(
      reconcileEventReminders({ userId: 'u1', eventId: 'e1' }),
    ).rejects.toThrow()
    tables.scheduled_reminders[0].createdAt = new Date(Date.now() - DAY)
    await expect(
      reconcileEventReminders({ userId: 'u1', eventId: 'e1' }),
    ).rejects.toThrow('idempotency window expired')
    expect(provider.scheduleEmail).toHaveBeenCalledTimes(1)
    expect(tables.scheduled_reminders).toHaveLength(1)
  })

  it('records provider-confirmed delivery and never prunes an uncertain send', async () => {
    seedEvent({ startDate: new Date(Date.now() - HOUR) })
    seedScheduled({ dueAt: new Date(Date.now() - 2 * DAY) })
    provider.scheduledEmailStatus.mockResolvedValue('sent')
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    seedScheduled({
      id: 'uncertain',
      eventId: 'deleted-event',
      dueAt: new Date(Date.now() - 2 * DAY),
    })
    expect(await pruneSpentReminders(new Date(Date.now() - DAY))).toBe(1)
    expect(tables.scheduled_reminders.map((r) => r.id)).toEqual(['uncertain'])
    expect(await pendingReminderEvents()).toEqual([
      { id: 'deleted-event', userId: 'u1' },
    ])
  })

  it('re-renders the reminder when the display timezone changes', async () => {
    seedEvent()
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    tables.calendar_settings.push({
      userId: 'u1',
      data: { timezone: 'America/New_York' },
    })
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    expect(provider.cancelEmail).toHaveBeenCalledTimes(1)
    expect(provider.scheduleEmail).toHaveBeenCalledTimes(2)
  })
  it('keeps a failed cancellation tracked and never queues its replacement', async () => {
    seedEvent()
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    const old = { ...tables.scheduled_reminders[0] }
    tables.calendar_events[0].title = 'Changed'
    provider.cancelEmail.mockResolvedValue(false)
    provider.scheduleEmail.mockClear()
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    expect(tables.scheduled_reminders).toEqual([
      { ...old, cancelPending: true },
    ])
    expect(provider.scheduleEmail).not.toHaveBeenCalled()
  })

  it('refreshes the rendered date when the event moves', async () => {
    seedEvent()
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    const before = provider.scheduleEmail.mock.calls[0]
    tables.calendar_events[0].startDate = new Date(Date.now() + 3 * DAY)
    tables.calendar_events[0].endDate = new Date(Date.now() + 3 * DAY + HOUR)
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    expect(provider.scheduleEmail).toHaveBeenCalledTimes(2)
    expect(provider.scheduleEmail.mock.calls[1]).not.toEqual(before)
  })

  it('uses a single-edited occurrence’s content and reminder settings', async () => {
    const start = new Date(Date.now() + 2 * DAY)
    seedEvent({
      rrule: 'FREQ=DAILY;COUNT=2',
      startDate: start,
      endDate: new Date(+start + HOUR),
    })
    const stamp = start
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z')
    seedEvent({
      id: 'override',
      seriesId: 'e1',
      recurrenceId: stamp,
      title: 'Only this one',
      notificationMinutes: 60,
      startDate: start,
      endDate: new Date(+start + 2 * HOUR),
    })
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    expect(
      provider.scheduleEmail.mock.calls.map(
        (call) => (call[0] as { subject: string }).subject,
      ),
    ).toContain('Reminder: Only this one')
    expect(
      tables.scheduled_reminders.find((r) => r.recurrenceId === stamp)?.dueAt,
    ).toEqual(new Date(+start - HOUR))
  })

  it('deduplicates concurrent top-up and save reconciliation', async () => {
    seedEvent()
    await Promise.all([
      reconcileEventReminders({ userId: 'u1', eventId: 'e1' }),
      reconcileEventReminders({ userId: 'u1', eventId: 'e1' }),
    ])
    expect(provider.scheduleEmail).toHaveBeenCalledTimes(1)
    expect(tables.scheduled_reminders).toHaveLength(1)
  })

  it('cancels a future send if the occurrence is moved into the past', async () => {
    seedEvent()
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    tables.calendar_events[0].startDate = new Date(Date.now() - HOUR)
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    expect(provider.cancelEmail).toHaveBeenCalledWith('provider-1')
    expect(provider.rescheduleEmail).not.toHaveBeenCalled()
    expect(tables.scheduled_reminders).toHaveLength(0)
  })

  it('schedules a send for an eligible event', async () => {
    seedEvent()
    const result = await reconcileEventReminders({
      userId: 'u1',
      eventId: 'e1',
    })
    expect(provider.scheduleEmail).toHaveBeenCalledTimes(1)
    expect(result.scheduled).toBe(1)
    expect(tables.scheduled_reminders).toHaveLength(1)
  })

  it('schedules nothing when the checkbox is off', async () => {
    seedEvent({ emailReminder: false })
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    expect(provider.scheduleEmail).not.toHaveBeenCalled()
  })

  it('cancels when the checkbox is turned off', async () => {
    seedEvent({ emailReminder: false })
    seedScheduled()
    const result = await reconcileEventReminders({
      userId: 'u1',
      eventId: 'e1',
    })
    expect(provider.cancelEmail).toHaveBeenCalledWith('provider-1')
    expect(result.cancelled).toBe(1)
    expect(tables.scheduled_reminders).toHaveLength(0)
  })

  it('cancels when the reminder is cleared to none', async () => {
    // Easy to miss: the checkbox is still ticked but there is no reminder time.
    seedEvent({ notificationMinutes: null })
    seedScheduled()
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    expect(provider.cancelEmail).toHaveBeenCalledWith('provider-1')
    expect(tables.scheduled_reminders).toHaveLength(0)
  })

  it('cancels everything when the event is gone', async () => {
    seedScheduled()
    const result = await reconcileEventReminders({
      userId: 'u1',
      eventId: 'e1',
    })
    expect(provider.cancelEmail).toHaveBeenCalledWith('provider-1')
    expect(result.cancelled).toBe(1)
  })

  it('re-creates the email when the title changes', async () => {
    // The provider's update endpoint accepts ONLY a new send time — it cannot
    // change a queued email's subject or body. So a title edit can only be
    // reflected by cancelling and re-creating; rescheduling would silently
    // leave the old wording queued.
    seedEvent()
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    const firstHash = tables.scheduled_reminders[0].contentHash
    expect(firstHash).toBeTruthy()

    provider.scheduleEmail.mockClear()
    provider.cancelEmail.mockClear()
    provider.rescheduleEmail.mockClear()

    tables.calendar_events[0].title = 'Renamed standup'
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })

    expect(provider.cancelEmail).toHaveBeenCalledTimes(1)
    expect(provider.scheduleEmail).toHaveBeenCalledTimes(1)
    expect(provider.rescheduleEmail).not.toHaveBeenCalled()
    expect(tables.scheduled_reminders).toHaveLength(1)
    expect(tables.scheduled_reminders[0].contentHash).not.toBe(firstHash)
  })

  it('re-creates the email when the location or description changes', async () => {
    seedEvent()
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    provider.scheduleEmail.mockClear()
    provider.cancelEmail.mockClear()

    tables.calendar_events[0].location = 'Room 42'
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    expect(provider.cancelEmail).toHaveBeenCalledTimes(1)
    expect(provider.scheduleEmail).toHaveBeenCalledTimes(1)
  })

  it('leaves the email alone when nothing the email renders changed', async () => {
    // Guard against the opposite failure: needlessly burning quota by
    // re-creating on every unrelated save.
    seedEvent()
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    provider.scheduleEmail.mockClear()
    provider.cancelEmail.mockClear()
    provider.rescheduleEmail.mockClear()

    // Colour is not in the email.
    tables.calendar_events[0].color = '#ff0000'
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })

    expect(provider.cancelEmail).not.toHaveBeenCalled()
    expect(provider.scheduleEmail).not.toHaveBeenCalled()
    expect(provider.rescheduleEmail).not.toHaveBeenCalled()
  })

  it('reschedules in place when only the reminder lead changes', async () => {
    const start = new Date(Date.now() + 2 * DAY)
    start.setUTCHours(12, 0, 0, 0)
    seedEvent({ startDate: start, endDate: new Date(+start + HOUR) })
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    provider.scheduleEmail.mockClear()
    provider.rescheduleEmail.mockClear()
    provider.cancelEmail.mockClear()

    // Same rendered event date, different send time: retain the provider id.
    tables.calendar_events[0].notificationMinutes = 60
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })

    expect(provider.rescheduleEmail).toHaveBeenCalledTimes(1)
    expect(provider.scheduleEmail).not.toHaveBeenCalled()
    expect(provider.cancelEmail).not.toHaveBeenCalled()
  })

  it('refreshes a legacy email whose old body cannot be verified', async () => {
    seedEvent()
    seedScheduled({ dueAt: new Date(Date.now() + 2 * DAY - 75 * 60_000) })

    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })

    expect(provider.cancelEmail).toHaveBeenCalledTimes(1)
    expect(provider.scheduleEmail).toHaveBeenCalledTimes(1)
    expect(tables.scheduled_reminders).toHaveLength(1)
  })

  it('retains the receipt when a reschedule result is uncertain', async () => {
    const start = new Date(Date.now() + 2 * DAY)
    start.setUTCHours(12, 0, 0, 0)
    seedEvent({ startDate: start, endDate: new Date(+start + HOUR) })
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    const before = { ...tables.scheduled_reminders[0] }
    provider.scheduleEmail.mockClear()
    provider.rescheduleEmail.mockResolvedValue(false)
    tables.calendar_events[0].notificationMinutes = 60
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    expect(tables.scheduled_reminders).toEqual([before])
    expect(provider.cancelEmail).not.toHaveBeenCalled()
    expect(provider.scheduleEmail).not.toHaveBeenCalled()
  })

  it('reports a provider failure but persists an encrypted retry receipt', async () => {
    provider.scheduleEmail.mockRejectedValue(new Error('provider down'))
    seedEvent()
    await expect(
      reconcileEventReminders({ userId: 'u1', eventId: 'e1' }),
    ).rejects.toThrow('provider down')
    expect(tables.scheduled_reminders).toHaveLength(1)
    expect(tables.scheduled_reminders[0].providerId).toBeNull()
    expect(tables.scheduled_reminders[0].payload).not.toContain('Standup')
    const request = provider.scheduleEmail.mock.calls[0][0]
    provider.scheduleEmail.mockResolvedValue('recovered-id')
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    expect(provider.scheduleEmail.mock.calls[1][0]).toEqual(request)
    expect(tables.scheduled_reminders[0].providerId).toBe('recovered-id')
  })

  it('refuses past the daily quota when strict', async () => {
    seedEvent()
    // Five sends already booked for the target date.
    const due = new Date(Date.now() + 2 * DAY - 15 * 60_000)
    const dueDate = `${due.getUTCFullYear()}-${String(
      due.getUTCMonth() + 1,
    ).padStart(2, '0')}-${String(due.getUTCDate()).padStart(2, '0')}`
    for (let i = 0; i < 5; i++) {
      tables.scheduled_reminders.push({
        id: `other${i}`,
        userId: 'u1',
        eventId: `other${i}`,
        recurrenceId: null,
        dueAt: due,
        dueDate,
        providerId: `p${i}`,
        sentAt: null,
      })
    }

    await expect(
      reconcileEventReminders({
        userId: 'u1',
        eventId: 'e1',
        strictQuota: true,
      }),
    ).rejects.toBeInstanceOf(SendQuotaExceeded)
  })

  it('skips quietly past the quota when not strict', async () => {
    // The cron must not throw; it retries tomorrow.
    seedEvent()
    const due = new Date(Date.now() + 2 * DAY - 15 * 60_000)
    const dueDate = `${due.getUTCFullYear()}-${String(
      due.getUTCMonth() + 1,
    ).padStart(2, '0')}-${String(due.getUTCDate()).padStart(2, '0')}`
    for (let i = 0; i < 5; i++) {
      tables.scheduled_reminders.push({
        id: `other${i}`,
        userId: 'u1',
        eventId: `other${i}`,
        recurrenceId: null,
        dueAt: due,
        dueDate,
        providerId: `p${i}`,
        sentAt: null,
      })
    }

    await expect(
      reconcileEventReminders({ userId: 'u1', eventId: 'e1' }),
    ).resolves.toMatchObject({ scheduled: 0 })
  })

  it('is idempotent across two runs', async () => {
    seedEvent()
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    provider.scheduleEmail.mockClear()
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    expect(provider.scheduleEmail).not.toHaveBeenCalled()
    expect(tables.scheduled_reminders).toHaveLength(1)
  })

  it('schedules only occurrences inside the 30-day horizon', async () => {
    seedEvent({
      rrule: 'FREQ=DAILY',
      startDate: new Date(Date.now() + HOUR),
      endDate: new Date(Date.now() + 2 * HOUR),
    })
    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    // A daily series never books beyond the provider's horizon in one pass.
    expect(provider.scheduleEmail.mock.calls.length).toBeLessThanOrEqual(31)
    expect(provider.scheduleEmail.mock.calls.length).toBeGreaterThan(0)
  })
})

describe('cancelRemindersForEvents', () => {
  it('cancels the provider copy, not just the row', async () => {
    // The receipt survives event deletion until provider cancellation succeeds.
    seedScheduled()
    await cancelRemindersForEvents(['e1'])
    expect(provider.cancelEmail).toHaveBeenCalledWith('provider-1')
    expect(tables.scheduled_reminders).toHaveLength(0)
  })

  it('is a no-op for an empty list', async () => {
    await cancelRemindersForEvents([])
    expect(provider.cancelEmail).not.toHaveBeenCalled()
  })
})

describe('clearRemindersPastSplit', () => {
  it('clears the tail and leaves the head alone', async () => {
    seedScheduled({
      id: 'head',
      recurrenceId: '20260801T090000Z',
      providerId: 'p-head',
    })
    seedScheduled({
      id: 'tail',
      recurrenceId: '20260815T090000Z',
      providerId: 'p-tail',
    })

    await clearRemindersPastSplit({
      oldMasterId: 'e1',
      boundaryStamp: '20260810T090000Z',
    })

    expect(provider.cancelEmail).toHaveBeenCalledWith('p-tail')
    expect(provider.cancelEmail).not.toHaveBeenCalledWith('p-head')
    expect(tables.scheduled_reminders.map((r) => r.id)).toEqual(['head'])
  })
})
