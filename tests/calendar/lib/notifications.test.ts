import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest'
import {
  getReminderTime,
  getReminderKey,
  isReminderDue,
  getPendingEvents,
  checkPendingNotifications,
} from '@/lib/notifications'
import type { CalendarEvent } from '@/components/app/calendar'

vi.mock('sonner', () => ({ toast: vi.fn() }))

const T0 = new Date('2026-08-22T12:00:00.000Z').getTime()

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'e1',
    title: 'Standup',
    startDate: new Date(T0),
    endDate: new Date(T0 + 30 * 60_000),
    isAllDay: false,
    participants: [],
    notification: 15,
    color: '#3B82F6',
    calendarId: '',
    ...overrides,
  }
}

const MIN = 60_000

describe('getReminderTime', () => {
  it('is null when there is no reminder', () => {
    expect(getReminderTime(event({ notification: null }))).toBeNull()
  })

  it('is the start itself for an at-start reminder', () => {
    expect(getReminderTime(event({ notification: 0 }))).toBe(T0)
  })

  it('subtracts the minutes from the start', () => {
    expect(getReminderTime(event({ notification: 15 }))).toBe(T0 - 15 * MIN)
  })

  it('is null for a negative or non-finite value', () => {
    expect(getReminderTime(event({ notification: -5 }))).toBeNull()
    expect(getReminderTime(event({ notification: NaN }))).toBeNull()
  })

  it('is null for an unparseable start date', () => {
    expect(
      getReminderTime(event({ startDate: new Date('nonsense') })),
    ).toBeNull()
  })
})

describe('isReminderDue', () => {
  it('is not due before its reminder time', () => {
    expect(isReminderDue(event({ notification: 15 }), T0 - 16 * MIN)).toBe(
      false,
    )
  })

  it('is due exactly at its reminder time', () => {
    expect(isReminderDue(event({ notification: 15 }), T0 - 15 * MIN)).toBe(true)
  })

  it('stays due through the catch-up window, up to the start', () => {
    expect(isReminderDue(event({ notification: 15 }), T0 - 1 * MIN)).toBe(true)
  })

  it('is dropped once the event has started', () => {
    expect(isReminderDue(event({ notification: 15 }), T0 + 1 * MIN)).toBe(false)
  })

  it('never fires for an event with no reminder', () => {
    expect(isReminderDue(event({ notification: null }), T0 - 1 * MIN)).toBe(
      false,
    )
  })

  describe('at-start reminder', () => {
    // Its reminder time equals the start, so without a floor the window would
    // be zero-width and it could never fire at all.
    it('is due at the start', () => {
      expect(isReminderDue(event({ notification: 0 }), T0)).toBe(true)
    })

    it('is still due inside the floor', () => {
      expect(isReminderDue(event({ notification: 0 }), T0 + 4 * MIN)).toBe(true)
    })

    it('is dropped past the floor', () => {
      expect(isReminderDue(event({ notification: 0 }), T0 + 6 * MIN)).toBe(
        false,
      )
    })
  })
})

describe('getPendingEvents', () => {
  it('excludes an already-fired reminder', () => {
    const e = event({ notification: 15 })
    const now = T0 - 10 * MIN
    const key = getReminderKey(e, getReminderTime(e)!)
    expect(getPendingEvents([e], now, {})).toHaveLength(1)
    expect(getPendingEvents([e], now, { [key]: now })).toHaveLength(0)
  })

  it('gives two occurrences of one series independent keys', () => {
    // Expanded occurrences carry instance ids, so the dedupe key distinguishes
    // them and both fire.
    const day1 = event({
      id: 'm1_20260822T120000Z',
      startDate: new Date(T0),
      endDate: new Date(T0 + 30 * MIN),
      notification: 15,
    })
    const day2 = event({
      id: 'm1_20260823T120000Z',
      startDate: new Date(T0 + 86_400_000),
      endDate: new Date(T0 + 86_400_000 + 30 * MIN),
      notification: 15,
    })

    const key1 = getReminderKey(day1, getReminderTime(day1)!)
    const key2 = getReminderKey(day2, getReminderTime(day2)!)
    expect(key1).not.toBe(key2)

    // Firing day 1 must not suppress day 2.
    const atDay2 = T0 + 86_400_000 - 10 * MIN
    expect(getPendingEvents([day2], atDay2, { [key1]: T0 })).toHaveLength(1)
  })
})

describe('checkPendingNotifications', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(Date, 'now').mockReturnValue(T0 - 10 * MIN)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('records a fired reminder so it survives a reload', async () => {
    const e = event({ notification: 15 })
    await checkPendingNotifications([e])

    const raw = localStorage.getItem('reminder-fired')
    expect(raw).not.toBeNull()
    expect(Object.keys(JSON.parse(raw!))).toContain(
      getReminderKey(e, getReminderTime(e)!),
    )

    // A fresh read of the persisted record — the reload case — sees it fired.
    const fired = JSON.parse(localStorage.getItem('reminder-fired')!)
    expect(getPendingEvents([e], Date.now(), fired)).toHaveLength(0)
  })

  it('does not record anything for an event with no reminder', async () => {
    await checkPendingNotifications([event({ notification: null })])
    expect(localStorage.getItem('reminder-fired')).toBeNull()
  })

  it('leaves storage untouched when nothing is due', async () => {
    // A poll tick with nothing to deliver must not write — otherwise this is a
    // localStorage write every minute for no reason.
    await checkPendingNotifications([
      event({ notification: 15, startDate: new Date(T0 + 86_400_000) }),
    ])
    expect(localStorage.getItem('reminder-fired')).toBeNull()
  })

  it('does not throw when localStorage is unavailable', async () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    await expect(
      checkPendingNotifications([event({ notification: 15 })]),
    ).resolves.toBeUndefined()
  })

  it('prunes records older than the retention window', async () => {
    const stale = T0 - 10 * MIN - 25 * 60 * 60_000
    localStorage.setItem(
      'reminder-fired',
      JSON.stringify({ 'old-event-123': stale }),
    )

    await checkPendingNotifications([event({ notification: 15 })])

    const fired = JSON.parse(localStorage.getItem('reminder-fired')!)
    expect(fired).not.toHaveProperty('old-event-123')
  })
})
