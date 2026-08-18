import { describe, it, expect } from 'vitest'
import {
  expandSeriesView,
  optimisticFollowingSplit,
  type SeriesViewInput,
} from '@/lib/recurrence/engine'

function day(y: number, m: number, d: number, h = 0, min = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h, min, 0))
}

function makeSeries(overrides: Partial<SeriesViewInput> = {}): SeriesViewInput {
  return {
    id: 'm1',
    title: 'Standup',
    startDate: day(2024, 1, 1, 9),
    endDate: day(2024, 1, 1, 10),
    isAllDay: false,
    rrule: 'FREQ=WEEKLY;BYDAY=MO',
    exdate: null,
    seriesId: null,
    recurrenceId: null,
    color: null,
    ...overrides,
  }
}

describe('expandSeriesView', () => {
  it('merges an override into the matching instance when the date is present', () => {
    const master = makeSeries()
    const override = {
      ...makeSeries(),
      id: 'override-uuid',
      seriesId: 'm1',
      recurrenceId: '20240108T090000Z',
      title: 'Edited',
      startDate: day(2024, 1, 9, 11),
      endDate: day(2024, 1, 9, 12),
    }
    const out = expandSeriesView(
      [master],
      [override],
      day(2024, 1, 1),
      day(2024, 2, 1),
    )
    const edited = out.find((e) => e.title === 'Edited')
    expect(edited).toBeDefined()
    expect(edited!.id).toBe('m1_20240108T090000Z')
    expect(edited!.seriesId).toBe('m1')
    expect(edited!.startDate).toEqual(day(2024, 1, 9, 11))
    expect(edited!.rrule).toBe(master.rrule)
  })

  it('keeps an override whose date was exdated (single-instance edit survives refetch)', () => {
    const master = makeSeries({ exdate: ['20240108T090000Z'] })
    const override = {
      ...makeSeries(),
      id: 'override-uuid',
      seriesId: 'm1',
      recurrenceId: '20240108T090000Z',
      title: 'Edited',
      startDate: day(2024, 1, 9, 11),
      endDate: day(2024, 1, 9, 12),
    }
    const out = expandSeriesView(
      [master],
      [override],
      day(2024, 1, 1),
      day(2024, 2, 1),
    )
    const edited = out.filter((e) => e.recurrenceId === '20240108T090000Z')
    expect(edited).toHaveLength(1)
    expect(edited[0].title).toBe('Edited')
    expect(edited[0].id).toBe('m1_20240108T090000Z')
    expect(edited[0].rrule).toBe(master.rrule)
    expect(edited[0].seriesId).toBe('m1')
  })

  it('drops a deleted instance (exdate without override)', () => {
    const master = makeSeries({ exdate: ['20240108T090000Z'] })
    const out = expandSeriesView([master], [], day(2024, 1, 1), day(2024, 2, 1))
    expect(out.some((e) => e.recurrenceId === '20240108T090000Z')).toBe(false)
  })
})

describe('optimisticFollowingSplit', () => {
  it('splits the series at the target and rebases the following instances', () => {
    const master = makeSeries()
    const instances = expandSeriesView(
      [master],
      [],
      day(2024, 1, 1),
      day(2024, 2, 1),
    ) as SeriesViewInput[]
    const target = instances.find((e) => e.recurrenceId === '20240115T090000Z')!
    const nextMaster = {
      ...target,
      id: 'new-series-1',
      seriesId: null,
      recurrenceId: null,
      title: 'Standup v2',
    }

    const split = optimisticFollowingSplit(
      instances,
      target,
      nextMaster,
      day(2024, 1, 1),
      day(2024, 2, 1),
    )

    expect(split).not.toBeNull()
    expect(split!.filter((e) => e.seriesId === 'm1')).toHaveLength(2)
    const following = split!.filter((e) => e.seriesId === 'new-series-1')
    expect(following.length).toBeGreaterThanOrEqual(2)
    expect(
      following.every(
        (e) => e.title === 'Standup v2' && e.rrule === master.rrule,
      ),
    ).toBe(true)
    expect(following.some((e) => e.recurrenceId === '20240115T090000Z')).toBe(
      true,
    )
  })

  it('returns null when the target is not a recurring instance', () => {
    const master = makeSeries()
    const instances = expandSeriesView(
      [master],
      [],
      day(2024, 1, 1),
      day(2024, 2, 1),
    )
    const plain = {
      ...makeSeries(),
      id: 'plain',
      seriesId: null,
      recurrenceId: null,
    }
    const split = optimisticFollowingSplit(
      instances,
      plain,
      { ...plain, id: 'x' },
      day(2024, 1, 1),
      day(2024, 2, 1),
    )
    expect(split).toBeNull()
  })
})
