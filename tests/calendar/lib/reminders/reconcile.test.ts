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

const provider = vi.hoisted(() => ({
  scheduleEmail: vi.fn(async () => 'provider-1'),
  rescheduleEmail: vi.fn(async () => true),
  cancelEmail: vi.fn(async () => true),
}))

vi.mock('@/lib/email/send-scheduled-email', () => ({
  ...provider,
  MAX_SCHEDULE_AHEAD_MS: 30 * 24 * 60 * 60 * 1000,
  EmailProviderUnavailable: class extends Error {},
}))

vi.mock('@/lib/email/reminder-template', () => ({
  buildReminderEmail: async () => '<p>reminder</p>',
}))

vi.mock('@/lib/api-helpers', () => ({
  decryptEvent: (e: unknown) => e,
  getAuthedUser: async () => ({ id: 'u1', email: 'u1@example.com' }),
}))

const tables: Record<string, Array<Record<string, unknown>>> = {
  calendar_events: [],
  scheduled_reminders: [],
  calendar_settings: [],
  user: [],
}

vi.mock('@/lib/drizzle/client', () => ({
  getDb: () => makeDb(),
}))

type Pred = (row: Record<string, unknown>) => boolean

function makeDb() {
  return {
    select: () => ({
      from: (t: { __name: string }) => ({
        where: (pred: Pred) =>
          Promise.resolve(tables[t.__name].filter((r) => pred(r))),
      }),
    }),
    insert: (t: { __name: string }) => ({
      values: (v: Record<string, unknown>) => {
        const apply = () => {
          tables[t.__name].push({ ...v })
          return [v]
        }
        return {
          then: (ok: (r: unknown) => unknown) =>
            Promise.resolve(apply()).then(ok),
          onConflictDoUpdate: () => ({
            then: (ok: (r: unknown) => unknown) =>
              Promise.resolve(apply()).then(ok),
          }),
        }
      },
    }),
    update: (t: { __name: string }) => ({
      set: (v: Record<string, unknown>) => ({
        where: (pred: Pred) => {
          for (const row of tables[t.__name]) {
            if (pred(row)) Object.assign(row, v)
          }
          return Promise.resolve([])
        },
      }),
    }),
    delete: (t: { __name: string }) => ({
      where: (pred: Pred) => {
        tables[t.__name] = tables[t.__name].filter((r) => !pred(r))
        return Promise.resolve([])
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
  }
})

import {
  cancelRemindersForEvents,
  reconcileEventReminders,
  clearRemindersPastSplit,
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
})

describe('reconcileEventReminders', () => {
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

  it('reschedules rather than duplicating when the time moves', async () => {
    seedEvent()
    // Existing row is an hour off from what the event now implies.
    seedScheduled({ dueAt: new Date(Date.now() + 2 * DAY - 75 * 60_000) })

    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })

    expect(provider.rescheduleEmail).toHaveBeenCalledTimes(1)
    expect(provider.scheduleEmail).not.toHaveBeenCalled()
    expect(tables.scheduled_reminders).toHaveLength(1)
  })

  it('drops the row when the provider refuses to reschedule', async () => {
    // Refusal usually means it already sent; a stale provider id is worse than
    // a missing row, which the top-up can re-create.
    provider.rescheduleEmail.mockResolvedValue(false)
    seedEvent()
    seedScheduled({ dueAt: new Date(Date.now() + 2 * DAY - 75 * 60_000) })

    await reconcileEventReminders({ userId: 'u1', eventId: 'e1' })
    expect(provider.cancelEmail).toHaveBeenCalled()
  })

  it('does not throw when the provider fails to schedule', async () => {
    provider.scheduleEmail.mockRejectedValue(new Error('provider down'))
    seedEvent()
    await expect(
      reconcileEventReminders({ userId: 'u1', eventId: 'e1' }),
    ).resolves.toMatchObject({ scheduled: 0 })
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
    // Cascade removes the row; only an explicit cancel stops the email.
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
