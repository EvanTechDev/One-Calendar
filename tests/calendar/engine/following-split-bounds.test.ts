import { describe, expect, it } from 'vitest'
import {
  expandSeriesView,
  optimisticFollowingSplit,
  reanchor,
  remainingSeriesCount,
  type SeriesViewInput,
} from '@/lib/recurrence/engine'
import { planInstanceChange, type EventRow } from '@/lib/event-service'

const day = (d: number, hour = 9) => new Date(Date.UTC(2026, 7, d, hour, 0, 0))

function masterRow(
  overrides: Partial<EventRow> = {},
): EventRow & Record<string, unknown> {
  return {
    id: 'master-1',
    userId: 'user-1',
    title: 'Daily sync',
    description: null,
    location: null,
    startDate: day(3),
    endDate: day(3, 10),
    isAllDay: false,
    status: 'confirmed',
    color: null,
    categoryId: null,
    participants: [],
    notificationMinutes: null,
    emailReminder: false,
    createdAt: day(1, 0),
    updatedAt: day(1, 0),
    rrule: 'FREQ=DAILY;COUNT=10',
    exdate: null,
    seriesId: null,
    recurrenceId: null,
    ...overrides,
  }
}

describe('remainingSeriesCount', () => {
  it('re-bases COUNT onto the split point', () => {
    // Daily ×10 starting Aug 3; splitting at the Aug 7 occurrence leaves
    // Aug 7..12 → 6 occurrences for the new series.
    const remaining = remainingSeriesCount(
      'RRULE:FREQ=DAILY;COUNT=10',
      day(3),
      day(7),
      'UTC',
    )
    expect(remaining).toBe(6)
  })

  it('keeps the full COUNT for a root split', () => {
    const remaining = remainingSeriesCount(
      'RRULE:FREQ=DAILY;COUNT=10',
      day(3),
      day(3),
      'UTC',
    )
    expect(remaining).toBe(10)
  })

  it('returns null for rules without COUNT and for unparseable rules', () => {
    expect(
      remainingSeriesCount('RRULE:FREQ=DAILY', day(3), day(7), 'UTC'),
    ).toBeNull()
    expect(remainingSeriesCount('not-a-rule', day(3), day(7), 'UTC')).toBeNull()
  })
})

describe('reanchor series bounds', () => {
  it('preserves the original UNTIL instead of making the series infinite', () => {
    const out = reanchor(
      'RRULE:FREQ=DAILY;UNTIL=20260903T000000Z',
      day(10),
      false,
      null,
    )
    expect(out).toContain('UNTIL=20260903T000000Z')
  })

  it('applies the remaining COUNT and drops it when unbounded', () => {
    expect(reanchor('RRULE:FREQ=DAILY;COUNT=10', day(10), false, 6)).toContain(
      'COUNT=6',
    )
    expect(
      reanchor('RRULE:FREQ=DAILY;COUNT=10', day(10), false, null),
    ).not.toContain('COUNT')
  })
})

describe('planInstanceChange split bounds', () => {
  it('anchors the new series with the remaining COUNT', () => {
    const plan = planInstanceChange({
      master: masterRow(),
      override: null,
      overrides: [],
      recurrenceId: '20260807T090000Z',
      applyTo: 'following',
      fields: {},
      now: day(1, 0),
      timeZone: 'UTC',
    })
    expect(plan.split).not.toBeNull()
    expect(plan.split!.newSeries.rrule).toContain('COUNT=6')
    expect(plan.split!.newSeries.rrule).toContain('FREQ=DAILY')
  })

  it('carries UNTIL over to the new series', () => {
    const plan = planInstanceChange({
      master: masterRow({ rrule: 'FREQ=DAILY;UNTIL=20260903T000000Z' }),
      override: null,
      overrides: [],
      recurrenceId: '20260807T090000Z',
      applyTo: 'following',
      fields: {},
      now: day(1, 0),
      timeZone: 'UTC',
    })
    expect(plan.split!.newSeries.rrule).toContain('UNTIL=20260903T000000Z')
  })

  it('leaves unbounded rules unbounded', () => {
    const plan = planInstanceChange({
      master: masterRow({ rrule: 'FREQ=DAILY' }),
      override: null,
      overrides: [],
      recurrenceId: '20260807T090000Z',
      applyTo: 'following',
      fields: {},
      now: day(1, 0),
      timeZone: 'UTC',
    })
    expect(plan.split!.newSeries.rrule).not.toContain('COUNT')
    expect(plan.split!.newSeries.rrule).not.toContain('UNTIL')
  })
})

describe('optimisticFollowingSplit override re-parenting', () => {
  it.each([1, 2])(
    'does not add a fourth day when saving unchanged occurrence %i',
    (index) => {
      const master = masterRow({ rrule: 'FREQ=DAILY;COUNT=3' })
      const before = expandSeriesView(
        [master],
        [],
        day(1, 0),
        day(15),
        1000,
        'UTC',
      )
      const target = before[index]
      const after = optimisticFollowingSplit(
        before,
        target,
        {
          ...target,
          id: 'split',
          seriesId: null,
          recurrenceId: null,
        },
        day(1, 0),
        day(15),
        1000,
        'UTC',
      )
      expect(
        after?.map((event) => new Date(event.startDate).toISOString()).sort(),
      ).toEqual(
        before.map((event) => new Date(event.startDate).toISOString()).sort(),
      )
    },
  )

  const daily = 'RRULE:FREQ=DAILY'

  it('counts hidden and out-of-window slots from the original anchor, not the cached rows', () => {
    const master = masterRow({
      rrule: 'FREQ=DAILY;COUNT=10',
      exdate: ['20260804T090000Z', '20260808T090000Z'],
    })
    const before = expandSeriesView(
      [master],
      [],
      day(7, 0),
      day(15),
      1000,
      'UTC',
    )
    const target = before[0]
    const after = optimisticFollowingSplit(
      before,
      target,
      { ...target, id: 'tail', seriesId: null, recurrenceId: null },
      day(7, 0),
      day(15),
      1000,
      'UTC',
    )!
    expect(after.map((row) => new Date(row.startDate).toISOString())).toEqual(
      before.map((row) => new Date(row.startDate).toISOString()),
    )
    expect(after[0].rrule).toContain('COUNT=6')
    expect(after.at(-1)?.startDate).toEqual(day(12))
  })

  it('defers optimistic expansion for old caches without the real COUNT anchor', () => {
    const master = masterRow({ rrule: 'FREQ=DAILY;COUNT=3' })
    const before = expandSeriesView(
      [master],
      [],
      day(4, 0),
      day(15),
      1000,
      'UTC',
    ).map((row) => ({ ...row, seriesStartDate: undefined }))
    expect(
      optimisticFollowingSplit(
        before,
        before[0],
        { ...before[0], id: 'tail', seriesId: null, recurrenceId: null },
        day(4, 0),
        day(15),
        1000,
        'UTC',
      ),
    ).toBeNull()
  })

  it('uses an explicitly changed count rather than shrinking the new rule', () => {
    const master = masterRow({ rrule: 'FREQ=DAILY;COUNT=3' })
    const before = expandSeriesView(
      [master],
      [],
      day(1, 0),
      day(15),
      1000,
      'UTC',
    )
    const after = optimisticFollowingSplit(
      before,
      before[1],
      {
        ...before[1],
        id: 'tail',
        seriesId: null,
        recurrenceId: null,
        rrule: 'FREQ=DAILY;COUNT=4',
      },
      day(1, 0),
      day(15),
      1000,
      'UTC',
    )!
    expect(after).toHaveLength(5)
    expect(after.at(-1)?.startDate).toEqual(day(7))
  })

  it('matches persisted split bounds for an unchanged all-day series', () => {
    const master = masterRow({
      startDate: day(3, 0),
      endDate: day(4, 0),
      isAllDay: true,
      rrule: 'FREQ=DAILY;COUNT=3',
    })
    const before = expandSeriesView(
      [master],
      [],
      day(1, 0),
      day(15),
      1000,
      'UTC',
    )
    const target = before[1]
    const plan = planInstanceChange({
      master,
      override: null,
      overrides: [],
      recurrenceId: target.recurrenceId!,
      applyTo: 'following',
      fields: { rrule: master.rrule },
      now: day(1),
      timeZone: 'UTC',
    })
    const after = optimisticFollowingSplit(
      before,
      target,
      { ...target, id: 'tail', seriesId: null, recurrenceId: null },
      day(1, 0),
      day(15),
      1000,
      'UTC',
    )!
    expect(after.map((row) => row.startDate)).toEqual(
      before.map((row) => row.startDate),
    )
    expect(after[1].rrule).toBe(plan.split?.newSeries.rrule)
  })
  const windowStart = day(1, 0)
  const windowEnd = new Date(Date.UTC(2026, 8, 1, 0, 0, 0))

  const plainInstance = (stamp: string, start: Date): SeriesViewInput => ({
    id: `master-1_${stamp}`,
    title: 'Daily sync',
    startDate: start,
    endDate: new Date(start.getTime() + 60 * 60 * 1000),
    isAllDay: false,
    rrule: daily,
    exdate: null,
    seriesId: 'master-1',
    recurrenceId: stamp,
    color: null,
    calendarId: null,
  })

  it('re-parents moved single-edits onto the new series instead of dropping them', () => {
    const target = plainInstance('20260810T090000Z', day(10))
    const movedOverride = {
      ...plainInstance('20260812T090000Z', day(12)),
      id: 'master-1_20260812T090000Z',
      isOverride: true,
      startDate: day(12, 14),
      endDate: day(12, 15),
    }
    const store = [
      plainInstance('20260808T090000Z', day(8)),
      plainInstance('20260809T090000Z', day(9)),
      target,
      movedOverride,
      plainInstance('20260811T090000Z', day(11)),
    ]
    const nextMaster = {
      ...target,
      id: 'new-master-1',
      seriesId: null,
      recurrenceId: null,
    }

    const split = optimisticFollowingSplit(
      store,
      target,
      nextMaster,
      windowStart,
      windowEnd,
    )

    expect(split).not.toBeNull()
    const moved = split!.find((e) => (e as { isOverride?: boolean }).isOverride)
    expect(moved).toBeDefined()
    // The override must live under the NEW series — expandSeriesView groups
    // overrides by seriesId, so keeping 'master-1' would silently drop it.
    expect((moved as { seriesId?: string | null }).seriesId).toBe(
      'new-master-1',
    )
    expect(
      new Date((moved as { startDate: Date }).startDate).toISOString(),
    ).toBe('2026-08-12T14:00:00.000Z')
    // Old series keeps only pre-split instances.
    const oldRows = split!.filter(
      (e) => (e as { seriesId?: string | null }).seriesId === 'master-1',
    )
    expect(
      oldRows.every(
        (e) =>
          ((e as { recurrenceId?: string | null }).recurrenceId ?? '') <
          '20260810T090000Z',
      ),
    ).toBe(true)
  })
})

describe('split view end-to-end (engine level)', () => {
  it('renders exactly one series after a root split — no overlap at the original position', () => {
    const daily = 'RRULE:FREQ=DAILY'
    const oldMaster = {
      id: 'master-1',
      title: 'Daily sync',
      startDate: day(10),
      endDate: day(10, 10),
      isAllDay: false,
      rrule: daily,
      exdate: null,
      seriesId: null,
      recurrenceId: null,
    }
    const newMaster = {
      ...oldMaster,
      id: 'new-master-1',
      title: 'Daily sync (moved)',
      startDate: day(10, 11),
      endDate: day(10, 12),
    }
    const windowStart = day(9, 0)
    const windowEnd = new Date(Date.UTC(2026, 7, 20, 0, 0, 0))
    const expanded = expandSeriesView(
      [newMaster],
      [],
      windowStart,
      windowEnd,
    ) as Array<{ seriesId: string | null; startDate: Date }>
    expect(expanded.length).toBeGreaterThan(0)
    expect(expanded.every((e) => e.seriesId === 'new-master-1')).toBe(true)
    expect(
      expanded.some((e) => e.startDate.getTime() === day(10).getTime()),
    ).toBe(false)
  })
})
