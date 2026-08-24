import { describe, expect, it } from 'vitest'
import {
  DAILY_SEND_QUOTA,
  applyQuota,
  candidatesFor,
  dueDateIn,
  isSchedulable,
  reminderTimeFor,
  scheduleKey,
  type OccurrenceInput,
} from '@/lib/reminders/email-schedule'

const NOW = new Date('2026-08-22T12:00:00.000Z')
const DAY = 86_400_000
const MIN = 60_000

function occurrence(
  startDate: Date,
  recurrenceId: string | null = null,
): OccurrenceInput {
  return { eventId: 'e1', recurrenceId, startDate }
}

describe('reminderTimeFor', () => {
  it('is null when the event has no reminder', () => {
    expect(reminderTimeFor(occurrence(NOW), null)).toBeNull()
  })

  it('is the start itself for an at-start reminder', () => {
    expect(reminderTimeFor(occurrence(NOW), 0)?.getTime()).toBe(NOW.getTime())
  })

  it('subtracts the minutes', () => {
    expect(reminderTimeFor(occurrence(NOW), 15)?.getTime()).toBe(
      NOW.getTime() - 15 * MIN,
    )
  })

  it('is null for a negative or non-finite value', () => {
    expect(reminderTimeFor(occurrence(NOW), -5)).toBeNull()
    expect(reminderTimeFor(occurrence(NOW), NaN)).toBeNull()
  })
})

describe('isSchedulable', () => {
  it('accepts a reminder 29 days out', () => {
    expect(isSchedulable(new Date(NOW.getTime() + 29 * DAY), NOW)).toBe(true)
  })

  it('refuses a reminder 31 days out', () => {
    // The provider rejects beyond 30 days, so the window must be checked here.
    expect(isSchedulable(new Date(NOW.getTime() + 31 * DAY), NOW)).toBe(false)
  })

  it('refuses a reminder exactly past the horizon', () => {
    expect(isSchedulable(new Date(NOW.getTime() + 30 * DAY + MIN), NOW)).toBe(
      false,
    )
  })

  it('accepts a reminder exactly at the horizon', () => {
    expect(isSchedulable(new Date(NOW.getTime() + 30 * DAY), NOW)).toBe(true)
  })

  it('refuses a reminder in the past', () => {
    expect(isSchedulable(new Date(NOW.getTime() - MIN), NOW)).toBe(false)
  })

  it('refuses a reminder due exactly now', () => {
    expect(isSchedulable(NOW, NOW)).toBe(false)
  })
})

describe('dueDateIn', () => {
  it('uses UTC when no timezone is given', () => {
    expect(dueDateIn(new Date('2026-08-22T23:30:00Z'))).toBe('2026-08-22')
  })

  it('resolves the date in the user timezone', () => {
    // 23:30 UTC is already the 23rd in Shanghai, so the quota belongs to the
    // 23rd for that user.
    expect(dueDateIn(new Date('2026-08-22T23:30:00Z'), 'Asia/Shanghai')).toBe(
      '2026-08-23',
    )
  })

  it('resolves a date that is still the previous day westward', () => {
    expect(
      dueDateIn(new Date('2026-08-22T03:00:00Z'), 'America/Los_Angeles'),
    ).toBe('2026-08-21')
  })

  it('handles a DST boundary', () => {
    // US DST ends 2026-11-01. 08:30 UTC is 01:30 local either side of the shift.
    expect(
      dueDateIn(new Date('2026-11-01T08:30:00Z'), 'America/New_York'),
    ).toBe('2026-11-01')
  })
})

describe('candidatesFor', () => {
  const base = {
    notificationMinutes: 15,
    emailReminder: true,
    now: NOW,
    alreadyScheduled: new Set<string>(),
  }

  it('is empty when email reminders are off', () => {
    expect(
      candidatesFor({
        ...base,
        emailReminder: false,
        occurrences: [occurrence(new Date(NOW.getTime() + DAY))],
      }),
    ).toEqual([])
  })

  it('is empty when the event has no reminder at all', () => {
    expect(
      candidatesFor({
        ...base,
        notificationMinutes: null,
        occurrences: [occurrence(new Date(NOW.getTime() + DAY))],
      }),
    ).toEqual([])
  })

  it('includes only occurrences inside the window', () => {
    const result = candidatesFor({
      ...base,
      occurrences: [
        occurrence(new Date(NOW.getTime() - DAY), 'past'),
        occurrence(new Date(NOW.getTime() + 5 * DAY), 'soon'),
        occurrence(new Date(NOW.getTime() + 40 * DAY), 'far'),
      ],
    })
    expect(result.map((c) => c.recurrenceId)).toEqual(['soon'])
  })

  it('skips occurrences that are already scheduled', () => {
    const already = new Set([scheduleKey({ eventId: 'e1', recurrenceId: 'a' })])
    const result = candidatesFor({
      ...base,
      alreadyScheduled: already,
      occurrences: [
        occurrence(new Date(NOW.getTime() + DAY), 'a'),
        occurrence(new Date(NOW.getTime() + 2 * DAY), 'b'),
      ],
    })
    expect(result.map((c) => c.recurrenceId)).toEqual(['b'])
  })

  it('returns one candidate per occurrence, earliest first', () => {
    const result = candidatesFor({
      ...base,
      occurrences: [
        occurrence(new Date(NOW.getTime() + 3 * DAY), 'c'),
        occurrence(new Date(NOW.getTime() + DAY), 'a'),
        occurrence(new Date(NOW.getTime() + 2 * DAY), 'b'),
      ],
    })
    expect(result.map((c) => c.recurrenceId)).toEqual(['a', 'b', 'c'])
  })

  it('assigns each candidate a due date in the user timezone', () => {
    const result = candidatesFor({
      ...base,
      timeZone: 'Asia/Shanghai',
      notificationMinutes: 0,
      occurrences: [occurrence(new Date('2026-08-23T23:30:00Z'), 's')],
    })
    expect(result[0].dueDate).toBe('2026-08-24')
  })
})

describe('applyQuota', () => {
  function candidate(dueDate: string, id: string) {
    return {
      eventId: 'e1',
      recurrenceId: id,
      dueAt: new Date(NOW.getTime() + DAY),
      dueDate,
    }
  }

  it('admits up to the quota for a date', () => {
    const candidates = Array.from({ length: DAILY_SEND_QUOTA }, (_, i) =>
      candidate('2026-08-23', `c${i}`),
    )
    const { allowed, refused } = applyQuota({
      candidates,
      usedByDate: new Map(),
    })
    expect(allowed).toHaveLength(DAILY_SEND_QUOTA)
    expect(refused).toHaveLength(0)
  })

  it('refuses the one past the quota', () => {
    const candidates = Array.from({ length: DAILY_SEND_QUOTA + 1 }, (_, i) =>
      candidate('2026-08-23', `c${i}`),
    )
    const { allowed, refused } = applyQuota({
      candidates,
      usedByDate: new Map(),
    })
    expect(allowed).toHaveLength(DAILY_SEND_QUOTA)
    expect(refused).toHaveLength(1)
  })

  it('counts existing sends against their own date', () => {
    const { allowed, refused } = applyQuota({
      candidates: [candidate('2026-08-23', 'x')],
      usedByDate: new Map([['2026-08-23', DAILY_SEND_QUOTA]]),
    })
    expect(allowed).toHaveLength(0)
    expect(refused).toHaveLength(1)
  })

  it('does not let one full date affect another', () => {
    const { allowed } = applyQuota({
      candidates: [candidate('2026-08-24', 'y')],
      usedByDate: new Map([['2026-08-23', DAILY_SEND_QUOTA]]),
    })
    expect(allowed).toHaveLength(1)
  })

  it('spreads a daily series across days rather than exhausting one', () => {
    const candidates = [
      candidate('2026-08-23', 'a'),
      candidate('2026-08-24', 'b'),
      candidate('2026-08-25', 'c'),
    ]
    const { allowed, refused } = applyQuota({
      candidates,
      usedByDate: new Map(),
    })
    expect(allowed).toHaveLength(3)
    expect(refused).toHaveLength(0)
  })
})
