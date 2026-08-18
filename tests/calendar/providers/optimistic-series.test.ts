import { describe, expect, it } from 'vitest'
import { optimisticSeries } from '@/components/providers/data-provider'
import type { EventData } from '@/lib/api-client'

const weeklyRule = 'RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO'

function baseEvent(overrides: Partial<EventData> = {}): EventData {
  return {
    id: 'evt',
    userId: 'u1',
    title: 'Standup',
    description: null,
    location: null,
    startDate: '2026-08-17T09:00:00.000Z',
    endDate: '2026-08-17T09:30:00.000Z',
    isAllDay: false,
    color: null,
    categoryId: null,
    participants: null,
    notificationMinutes: null,
    rrule: null,
    exdate: null,
    seriesId: null,
    recurrenceId: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('optimisticSeries', () => {
  it('expands a new recurring series from the payload when no master is cached', () => {
    const out = optimisticSeries(
      {
        id: 'new-uuid',
        title: 'Weekly sync',
        startDate: '2026-08-17T09:00:00.000Z',
        endDate: '2026-08-17T09:30:00.000Z',
        isAllDay: false,
        rrule: weeklyRule,
      },
      [],
    )

    expect(out).not.toBeNull()
    const instances = out!.filter((e) => e.seriesId === 'new-uuid')
    expect(instances.length).toBeGreaterThan(1)
    expect(out!.every((e) => e.seriesId === 'new-uuid')).toBe(true)

    const occurrences = instances
      .map((e) => new Date(e.startDate).getDay())
      .filter((_, index, arr) => arr[index] !== undefined)
    expect(occurrences.every((day) => day === 1)).toBe(true)

    const first = [...instances].sort(
      (a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    )[0]
    expect(new Date(first!.startDate).toISOString()).toBe(
      '2026-08-17T09:00:00.000Z',
    )
    expect(first!.title).toBe('Weekly sync')
    expect(first!.id.startsWith('new-uuid_')).toBe(true)
  })

  it('expands a new series with a matching rrule weekday', () => {
    const out = optimisticSeries(
      {
        id: 'new-uuid',
        title: 'Sync',
        startDate: '2026-08-19T09:00:00.000Z',
        endDate: '2026-08-19T09:30:00.000Z',
        isAllDay: false,
        rrule: 'RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=WE',
      },
      [],
    )

    expect(out).not.toBeNull()
    const instances = out!.filter((e) => e.seriesId === 'new-uuid')
    expect(instances.length).toBeGreaterThan(1)
    const days = instances.map((e) => new Date(e.startDate).getDay())
    expect(days.every((day) => day === 3)).toBe(true)
    expect(
      instances.some(
        (e) =>
          new Date(e.startDate).toISOString() === '2026-08-19T09:00:00.000Z',
      ),
    ).toBe(true)
  })

  it('omits exdated occurrences when creating a series with exdate', () => {
    const plain = optimisticSeries(
      {
        id: 'new-uuid',
        title: 'Sync',
        startDate: '2026-08-17T09:00:00.000Z',
        endDate: '2026-08-17T09:30:00.000Z',
        isAllDay: false,
        rrule: weeklyRule,
      },
      [],
    )
    const withExdate = optimisticSeries(
      {
        id: 'new-uuid',
        title: 'Sync',
        startDate: '2026-08-17T09:00:00.000Z',
        endDate: '2026-08-17T09:30:00.000Z',
        isAllDay: false,
        rrule: weeklyRule,
        exdate: ['20260817T090000Z'],
      },
      [],
    )

    expect(plain!.length).toBe(withExdate!.length + 1)
    expect(
      withExdate!.some(
        (e) =>
          new Date(e.startDate).toISOString() === '2026-08-17T09:00:00.000Z',
      ),
    ).toBe(false)
  })

  it('regenerates the full series for an instance edit with apply_to all', () => {
    const cache = [
      baseEvent({
        id: 'master-1_20260810T090000Z',
        seriesId: 'master-1',
        recurrenceId: '20260810T090000Z',
        rrule: weeklyRule,
        startDate: '2026-08-10T09:00:00.000Z',
        endDate: '2026-08-10T09:30:00.000Z',
      }),
      baseEvent({
        id: 'master-1_20260817T090000Z',
        seriesId: 'master-1',
        recurrenceId: '20260817T090000Z',
        rrule: weeklyRule,
        startDate: '2026-08-17T09:00:00.000Z',
        endDate: '2026-08-17T09:30:00.000Z',
      }),
      baseEvent({
        id: 'master-1_20260824T090000Z',
        seriesId: 'master-1',
        recurrenceId: '20260824T090000Z',
        rrule: weeklyRule,
        startDate: '2026-08-24T09:00:00.000Z',
        endDate: '2026-08-24T09:30:00.000Z',
      }),
    ]

    const out = optimisticSeries(
      {
        id: 'master-1_20260817T090000Z',
        title: 'Standup',
        startDate: '2026-08-17T10:00:00.000Z',
        endDate: '2026-08-17T10:30:00.000Z',
        isAllDay: false,
        apply_to: 'all',
      },
      cache,
    )

    expect(out).not.toBeNull()
    expect(out!.length).toBeGreaterThanOrEqual(3)
    const edited = out!.find((e) => e.id === 'master-1_20260817T100000Z')
    expect(edited).toBeDefined()
    expect(new Date(edited!.startDate).toISOString()).toBe(
      '2026-08-17T10:00:00.000Z',
    )
    expect(new Date(edited!.endDate).toISOString()).toBe(
      '2026-08-17T10:30:00.000Z',
    )
    const monday = out!.filter((e) => new Date(e.startDate).getDay() === 1)
    expect(monday.length).toBe(out!.length)
    expect(out!.every((e) => e.seriesId === 'master-1')).toBe(true)
  })

  it('adapts the rrule weekday to a moved instance start', () => {
    const cache = [
      baseEvent({
        id: 'master-1_20260817T090000Z',
        seriesId: 'master-1',
        recurrenceId: '20260817T090000Z',
        rrule: weeklyRule,
        startDate: '2026-08-17T09:00:00.000Z',
        endDate: '2026-08-17T09:30:00.000Z',
      }),
      baseEvent({
        id: 'master-1_20260824T090000Z',
        seriesId: 'master-1',
        recurrenceId: '20260824T090000Z',
        rrule: weeklyRule,
        startDate: '2026-08-24T09:00:00.000Z',
        endDate: '2026-08-24T09:30:00.000Z',
      }),
    ]

    const out = optimisticSeries(
      {
        id: 'master-1_20260817T090000Z',
        title: 'Standup',
        startDate: '2026-08-19T09:00:00.000Z',
        endDate: '2026-08-19T09:30:00.000Z',
        isAllDay: false,
        apply_to: 'all',
      },
      cache,
    )

    expect(out).not.toBeNull()
    const edited = out!.find((e) => e.id === 'master-1_20260819T090000Z')
    expect(edited).toBeDefined()
    expect(new Date(edited!.startDate).toISOString()).toBe(
      '2026-08-19T09:00:00.000Z',
    )
    const wednesdays = out!.filter((e) => new Date(e.startDate).getDay() === 3)
    expect(wednesdays.length).toBeGreaterThanOrEqual(2)
  })

  it('returns null for a plain edit without a recurrence rule', () => {
    const cache = [
      baseEvent({
        id: 'plain-1',
        seriesId: null,
        recurrenceId: null,
        startDate: '2026-08-17T09:00:00.000Z',
      }),
    ]

    const out = optimisticSeries(
      {
        id: 'plain-1',
        title: 'Standup',
        startDate: '2026-08-17T10:00:00.000Z',
        endDate: '2026-08-17T10:30:00.000Z',
        isAllDay: false,
      },
      cache,
    )

    expect(out).toBeNull()
  })
})
